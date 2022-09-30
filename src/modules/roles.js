const utils = require("../utils");
const {
  setModeratorDefaultRoleOverride,
  resetModeratorDefaultRoleOverride,

  setModeratorThreadRoleOverride,
  resetModeratorThreadRoleOverride,

  getModeratorThreadDisplayRoleName,
  getModeratorDefaultDisplayRoleName,
} = require("../data/displayRoles");
const {getOrFetchChannel} = require("../utils");

module.exports = ({ bot, knex, config, commands }) => {
  if (! config.allowChangingDisplayRole) {
    return;
  }

  function resolveRoleInput(input) {
    if (utils.isSnowflake(input)) {
      return utils.getInboxGuild().roles.get(input);
    }

    return utils.getInboxGuild().roles.find(r => r.name.toLowerCase() === input.toLowerCase());
  }

  // Get display role for a thread
  commands.addInboxThreadCommand("role", [], async (msg, args, thread) => {
    const displayRole = await getModeratorThreadDisplayRoleName(msg.member, thread.id);
    if (displayRole) {
      thread.postSystemMessage(`Votre rôle d'affichage dans ce ticket est actuellement **${displayRole}**`);
    } else {
      thread.postSystemMessage("Vos réponses dans ce ticket de discussion n'affichent actuellement aucun rôle");
    }
  }, { allowSuspended: true });

  // Reset display role for a thread
  commands.addInboxThreadCommand("role reset", [], async (msg, args, thread) => {
    await resetModeratorThreadRoleOverride(msg.member.id, thread.id);

    const displayRole = await getModeratorThreadDisplayRoleName(msg.member, thread.id);
    if (displayRole) {
      thread.postSystemMessage(`Votre rôle d'affichage pour ce ticket a été réinitialisé. Vos réponses afficheront désormais le rôle par défaut **${displayRole}**.`);
    } else {
      thread.postSystemMessage("Votre rôle d'affichage pour ce ticket a été réinitialisé. Vos réponses n'afficheront plus de rôle.");
    }
  }, {
    aliases: ["role_reset", "reset_role"],
    allowSuspended: true,
  });

  // Set display role for a thread
  commands.addInboxThreadCommand("role", "<role:string$>", async (msg, args, thread) => {
    const role = resolveRoleInput(args.role);
    if (! role || ! msg.member.roles.includes(role.id)) {
      thread.postSystemMessage("Aucun rôle correspondant trouvé. Assurez-vous d'avoir le rôle avant d'essayer de le définir comme votre rôle d'affichage dans ce ticket.");
      return;
    }

    await setModeratorThreadRoleOverride(msg.member.id, thread.id, role.id);
    thread.postSystemMessage(`Votre rôle d'affichage pour ce ticket a été défini sur **${role.name}**. Vous pouvez le réinitialiser avec \`${config.prefix}role reset\`.`);
  }, { allowSuspended: true });

  // Get default display role
  commands.addInboxServerCommand("role", [], async (msg, args, thread) => {
    const channel = await getOrFetchChannel(bot, msg.channel.id);
    const displayRole = await getModeratorDefaultDisplayRoleName(msg.member);
    if (displayRole) {
      channel.createMessage(`Votre rôle d'affichage par défaut est actuellement **${displayRole}**`);
    } else {
      channel.createMessage("Vos réponses n'affichent actuellement pas de rôle par défaut");
    }
  });

  // Reset default display role
  commands.addInboxServerCommand("role reset", [], async (msg, args, thread) => {
    await resetModeratorDefaultRoleOverride(msg.member.id);

    const channel = await getOrFetchChannel(bot, msg.channel.id);
    const displayRole = await getModeratorDefaultDisplayRoleName(msg.member);
    if (displayRole) {
      channel.createMessage(`Votre rôle d'affichage par défaut a été réinitialisé. Vos réponses afficheront désormais le rôle **${displayRole}** par défaut.`);
    } else {
      channel.createMessage("Votre rôle d'affichage par défaut a été réinitialisé. Vos réponses n'afficheront plus de rôle par défaut.");
    }
  }, {
    aliases: ["role_reset", "reset_role"],
  });

  // Set default display role
  commands.addInboxServerCommand("role", "<role:string$>", async (msg, args, thread) => {
    const channel = await getOrFetchChannel(bot, msg.channel.id);
    const role = resolveRoleInput(args.role);
    if (! role || ! msg.member.roles.includes(role.id)) {
      channel.createMessage("Aucun rôle correspondant trouvé. Assurez-vous que vous disposez du rôle avant d'essayer de le définir comme rôle d'affichage par défaut.");
      return;
    }

    await setModeratorDefaultRoleOverride(msg.member.id, role.id);
    channel.createMessage(`Votre rôle d'affichage par défaut a été défini sur **${role.name}**. Vous pouvez le réinitialiser avec \`${config.prefix}role reset\`.`);
  });
};
