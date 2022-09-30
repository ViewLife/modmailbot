const threads = require("../data/threads");
const moment = require("moment");
const utils = require("../utils");
const { getLogUrl, getLogFile, getLogCustomResponse, saveLogToStorage } = require("../data/logs");
const { THREAD_STATUS } = require("../data/constants");
const {getOrFetchChannel} = require("../utils");

const LOG_LINES_PER_PAGE = 10;

module.exports = ({ bot, knex, config, commands, hooks }) => {
  const addOptQueryStringToUrl = (url, args) => {
    const params = [];
    if (args.verbose) params.push("verbose=1");
    if (args.simple) params.push("simple=1");

    if (params.length === 0) {
      return url;
    }

    const hasQueryString = url.indexOf("?") > -1;
    return url + (hasQueryString ? "&" : "?") + params.join("&");
  };

  const logsCmd = async (msg, args, thread) => {
    let userId = args.userId || (thread && thread.user_id);
    if (! userId) return;

    const channel = await getOrFetchChannel(bot, msg.channel.id);
    let userThreads = await threads.getClosedThreadsByUserId(userId);

    // Descending by date
    userThreads.sort((a, b) => {
      if (a.created_at > b.created_at) return -1;
      if (a.created_at < b.created_at) return 1;
      return 0;
    });

    // Pagination
    const totalUserThreads = userThreads.length;
    const maxPage = Math.ceil(totalUserThreads / LOG_LINES_PER_PAGE);
    const inputPage = args.page;
    const page = Math.max(Math.min(inputPage ? parseInt(inputPage, 10) : 1, maxPage), 1); // Clamp page to 1-<max page>
    const isPaginated = totalUserThreads > LOG_LINES_PER_PAGE;
    const start = (page - 1) * LOG_LINES_PER_PAGE;
    const end = page * LOG_LINES_PER_PAGE;
    userThreads = userThreads.slice((page - 1) * LOG_LINES_PER_PAGE, page * LOG_LINES_PER_PAGE);

    const threadLines = await Promise.all(userThreads.map(async userThread => {
      const logUrl = await getLogUrl(userThread);
      const formattedLogUrl = logUrl
        ? `<${addOptQueryStringToUrl(logUrl, args)}>`
        : `Afficher les logs avec \`${config.prefix}log ${userThread.thread_number}\``
      const formattedDate = moment.utc(userThread.created_at).format("MMM Do [at] HH:mm [UTC]");
      return `\`#${userThread.thread_number}\` \`${formattedDate}\`: ${formattedLogUrl}`;
    }));

    let message = isPaginated
      ? `**Logs pour <@${userId}>** (page **${page}/${maxPage}**, Logs **${start + 1}-${end}/${totalUserThreads}**):`
      : `**Fichiers Logs pour <@${userId}>:**`;

    message += `\n${threadLines.join("\n")}`;

    if (isPaginated) {
      message += "\nPour en voir plus, ajoutez un numéro de page à la fin de la commande";
    }

    if (threadLines.length === 0) message = `**Il n'y a pas de logs pour <@${userId}>**`;
    
    // Send the list of logs in chunks of 15 lines per message
    const lines = message.split("\n");
    const chunks = utils.chunk(lines, 15);

    let root = Promise.resolve();
    chunks.forEach(chunkLines => {
      root = root.then(() => channel.createMessage(chunkLines.join("\n")));
    });
  };

  const logCmd = async (msg, args, _thread) => {
    const threadId = args.threadId || (_thread && _thread.id);
    if (! threadId) return;

    const thread = (await threads.findById(threadId)) || (await threads.findByThreadNumber(threadId));
    if (! thread) return;

    const channel = await getOrFetchChannel(bot, msg.channel.id);

    const customResponse = await getLogCustomResponse(thread);
    if (customResponse && (customResponse.content || customResponse.file)) {
      channel.createMessage(customResponse.content, customResponse.file);
    }

    const logUrl = await getLogUrl(thread);
    if (logUrl) {
      channel.createMessage(`Ouvrez le lien suivant pour afficher le logs du ticket #${thread.thread_number}:\n<${addOptQueryStringToUrl(logUrl, args)}>`);
      return;
    }

    const logFile = await getLogFile(thread);
    if (logFile) {
      channel.createMessage(`Téléchargez le fichier suivant pour afficher les logs du ticket #${thread.thread_number}:`, logFile);
      return;
    }

    if (thread.status === THREAD_STATUS.OPEN) {
      channel.createMessage(`Les logs de ce ticket ne sont pas disponibles actuellement, mais il est ouvert à <#${thread.channel_id}>`);
      return;
    }

    channel.createMessage("Les logq de ce ticket ne sont pas disponibles actuellement");
  };

  const logCmdOptions = [
    { name: "verbose", shortcut: "v", isSwitch: true },
    { name: "simple", shortcut: "s", isSwitch: true },
  ];

  commands.addInboxServerCommand("logs", "<userId:userId> [page:number]", logsCmd, { options: logCmdOptions });
  commands.addInboxServerCommand("logs", "[page:number]", logsCmd, { options: logCmdOptions });

  // Add these two overrides to allow using the command in suspended threads
  commands.addInboxThreadCommand("log", "", logCmd, { options: logCmdOptions, aliases: ["thread"], allowSuspended: true });
  commands.addInboxThreadCommand("loglink", "", logCmd, { options: logCmdOptions, allowSuspended: true });

  commands.addInboxServerCommand("log", "<threadId:string>", logCmd, { options: logCmdOptions, aliases: ["thread"] });
  commands.addInboxServerCommand("loglink", "<threadId:string>", logCmd, { options: logCmdOptions });

  hooks.afterThreadClose(async ({ threadId }) => {
    const thread = await threads.findById(threadId);
    await saveLogToStorage(thread);
  });
};
