module.exports = ({ bot, knex, config, commands }) => {
  commands.addInboxThreadCommand("alert", "[opt:string]", async (msg, args, thread) => {
    if (args.opt && args.opt.startsWith("c")) {
      await thread.removeAlert(msg.author.id)
      await thread.postSystemMessage("Alerte nouveau message annulée");
    } else {
      await thread.addAlert(msg.author.id);
      await thread.postSystemMessage(`Ping ${msg.author.username}#${msg.author.discriminator} quand ce fil reçoit une nouvelle réponse`);
    }
  }, { allowSuspended: true });
};
