const { SlashCommandBuilder } = require('discord.js');
const db = require('../db'); // Import your database connection module

// Function to clean a nickname, removing bot-added status tags
function cleanNickname(name) {
    // This regex looks for a space followed by [status] at the end of the string.
    // Ensure this regex matches the exact status options defined in the SlashCommandBuilder.
    const statusPattern = /\\\\s\\\\[(creative-flow|client-work|available|busy|break)\\\\]$/i;
    return name.replace(statusPattern, '').trim(); // .trim() to remove potential trailing spaces
}

module.exports = {
    // Define the slash command data
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Set your custom status or view current status.')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Your desired status')
                .setRequired(false) // Make it optional
                .addChoices(
                    { name: 'Creative Flow', value: 'creative-flow' },
                    { name: 'Client Work', value: 'client-work' },
                    { name: 'Available', value: 'available' },
                    { name: 'Busy', value: 'busy' },
                    { name: 'Break', value: 'break' },
                )),

    // Execute function for when the command is called
    async execute(interaction) {
        const userStatus = interaction.options.getString('status');
        const userId = interaction.user.id;
        
        // Ensure the command is used in a guild (server) context for nickname changes
        if (!interaction.guild || !interaction.member) {
            // Use reply here because deferReply hasn't happened yet
            await interaction.reply({ content: '❌ This command can only be used in a server to manage nicknames.', ephemeral: true });
            return;
        }

        const guildId = interaction.guild.id; // Guild ID is essential for nicknames and DB operations
        const member = interaction.member; // The GuildMember object for the user

        // Defer the reply to give more time for database operations
        // All subsequent replies will use editReply
        await interaction.deferReply({ ephemeral: true }); 

        try {
            if (userStatus) { // User provided a status to set
                // Database update
                await db.query('SELECT set_user_status($1, $2, $3)', [userId, guildId, userStatus]);
                let replyContent = `✅ Your status has been set to: **${userStatus}**. It will expire in 4 hours.`;

                // Nickname update logic
                const baseName = cleanNickname(member.displayName); // Get current display name without a potential old bot status
                let newNickname = `${baseName} [${userStatus}]`;

                // Handle Discord nickname length limit (32 characters)
                if (newNickname.length > 32) {
                    const statusSuffix = ` [${userStatus}]`;
                    const availableLengthForBaseName = 32 - statusSuffix.length;

                    if (availableLengthForBaseName < 1) { // If status suffix itself is too long or barely leaves space
                        newNickname = userStatus.substring(0, 32); // Fallback: just use truncated status
                    } else {
                        newNickname = `${baseName.substring(0, availableLengthForBaseName)}${statusSuffix}`;
                    }
                }

                try {
                    await member.setNickname(newNickname, 'Set user status via Flow Status Bot');
                    replyContent += `
Your server nickname has been updated to: \`${newNickname}\`.`;
                } catch (nickError) {
                    console.error(`Failed to set nickname for ${member.user.tag} (${userId}) in guild ${guildId}:`, nickError);
                    if (nickError.code === 50013) { // Missing Permissions
                        replyContent += `
⚠️ I could not update your nickname due to missing permissions. Please ensure I have the "Manage Nicknames" permission and my role is above yours.`;
                    } else {
                        replyContent += `
⚠️ An unexpected error occurred while trying to update your nickname.`;
                    }
                }
                await interaction.editReply({ content: replyContent }); // Use editReply after deferring

            } else { // User did not provide a status, so check current status
                const result = await db.query('SELECT * FROM get_user_status($1, $2)', [userId, guildId]);

                if (result.rows.length > 0) { // Active status found
                    const currentStatus = result.rows[0];
                    const expirationUnixTimestamp = Math.floor(currentStatus.expires_at.getTime() / 1000);
                    let replyContent = `🌐 Your current status is: **${currentStatus.status}** (expires <t:${expirationUnixTimestamp}:R>)`;

                    // Nickname synchronization logic
                    const baseName = cleanNickname(member.displayName);
                    let expectedNickname = `${baseName} [${currentStatus.status}]`;

                    // Handle Discord nickname length limit (32 characters) for sync
                    if (expectedNickname.length > 32) {
                        const statusSuffix = ` [${currentStatus.status}]`;
                        const availableLengthForBaseName = 32 - statusSuffix.length;

                        if (availableLengthForBaseName < 1) {
                            expectedNickname = currentStatus.status.substring(0, 32);
                        } else {
                            expectedNickname = `${baseName.substring(0, availableLengthForBaseName)}${statusSuffix}`;
                        }
                    }

                    // Only update if nickname is different to avoid unnecessary API calls
                    if (member.nickname !== expectedNickname) {
                        try {
                            await member.setNickname(expectedNickname, 'Synchronize user status nickname');
                            replyContent += `
Your server nickname has been synchronized to: \`${expectedNickname}\`.`;
                        } catch (nickError) {
                            console.error(`Failed to synchronize nickname for ${member.user.tag} (${userId}) in guild ${guildId}:`, nickError);
                            if (nickError.code === 50013) {
                                replyContent += `
⚠️ I could not synchronize your nickname due to missing permissions.`;
                            } else {
                                replyContent += `
⚠️ An unexpected error occurred while trying to synchronize your nickname.`;
                            }
                        }
                    }
                    await interaction.editReply({ content: replyContent }); // Use editReply after deferring

                } else { // No active status found for the user
                    let replyContent = '🤔 You do not have an active custom status set in this server. Use `/status <your-status>` to set one!';

                    // Attempt to clean up nickname if it currently contains a bot-added status
                    const currentDisplayName = member.displayName; // The name Discord shows for the user
                    const cleanedDisplayName = cleanNickname(currentDisplayName); // What the name should be without our bot's status tag

                    // Check if the current display name is different from the cleaned version,
                    // implying it had a bot-added status. 
                    const hasBotAddedStatus = currentDisplayName !== cleanedDisplayName;

                    if (hasBotAddedStatus) {
                        try {
                            // If the cleaned name is the same as the user's username, then set nickname to null to remove it.
                            // Otherwise, set it to the cleaned display name.
                            const finalNicknameToSet = (cleanedDisplayName === member.user.username) ? null : cleanedDisplayName;
                            await member.setNickname(finalNicknameToSet, 'Remove expired/no status from nickname');
                            replyContent += `
Your server nickname has been reset.`;
                        } catch (nickError) {
                            console.error(`Failed to clear nickname for ${member.user.tag} (${userId}) in guild ${guildId}:`, nickError);
                            if (nickError.code === 50013) {
                                replyContent += `
⚠️ I could not reset your nickname due to missing permissions.`;
                            } else {
                                replyContent += `
⚠️ An unexpected error occurred while trying to reset your nickname.`;
                            }
                        }
                    }
                    await interaction.editReply({ content: replyContent }); // Use editReply after deferring
                }
            }
        } catch (error) {
            console.error('Error interacting with database for status command:', error);
            // If an error occurs after deferring, use editReply
            // The ephemeral flag is already set from deferReply, so it's not needed here.
            await interaction.editReply({ content: '❌ An error occurred while trying to process your status. Please try again later.' });
        }
    },
};
