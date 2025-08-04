const { SlashCommandBuilder } = require('discord.js');
const db = require('../db'); // Import your database connection module

// Function to clean a nickname, removing bot-added status tags
function cleanNickname(name) {
    const statusPattern = /\\s\\[(creative-flow|client-work|available|busy|break)\\]$/i;
    return name.replace(statusPattern, '').trim();
}

module.exports = {
    // Define the slash command data
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Set your custom status or view current status (DEBUG MODE).') // FIXED: Removed trailing backslash
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Your desired status (ignored in DEBUG MODE)')
                .setRequired(false)
                .addChoices(
                    { name: 'Creative Flow', value: 'creative-flow' },
                    { name: 'Client Work', value: 'client-work' },
                    { name: 'Available', value: 'available' },
                    { name: 'Busy', value: 'busy' },
                    { name: 'Break', value: 'break' },
                )),

    // Execute function for when the command is called
    async execute(interaction) {
        // Handle cases where the command is NOT in a guild (e.g., DMs) immediately.
        // This check MUST happen before deferReply if deferReply is only for guilds.
        if (!interaction.guild || !interaction.member) {
            return interaction.reply({ 
                content: '❌ This command can only be used in a server to manage nicknames.', 
                flags: 64 // Use flags for ephemeral
            });
        }

        // Defer the reply to give more time for database operations.
        try {
            await interaction.deferReply({ flags: 64 }); // Use flags for ephemeral
        } catch (deferError) {
            console.error(`Failed to defer reply for interaction ${interaction.id}:`, deferError);
            // If deferReply fails (e.g., Unknown interaction due to timeout or Discord API error),
            // we cannot reply or editReply. Log the error and exit to prevent InteractionNotReplied.
            return;
        }

        let replyContent = '';

        try {
            console.log('Executing database status check (DEBUG MODE)...');
            
            // Simple database test - just check connection and get basic info
            const dbTest = await db.query(`
                SELECT 
                    NOW() as current_time,
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_records
                FROM user_status
            `);
            
            console.log('Database query successful:', dbTest.rows[0]);
            
            // Try to insert a status record (simple INSERT, no conflicts)
            const testUserId = interaction.user.id;
            const testGuildId = interaction.guild.id;
            
            await db.query(`
                INSERT INTO user_status (user_id, guild_id, status, timestamp, expires_at)
                VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL \'1 hour\')
                ON CONFLICT (user_id, guild_id, timestamp) DO UPDATE SET
                status = EXCLUDED.status, expires_at = EXCLUDED.expires_at;
            `, [testUserId, testGuildId, 'creative-flow-test']);
            
            console.log('Status test record inserted/updated for user:', testUserId);

            replyContent = `✅ Database test successful!
Connected. Current DB time: \` ${dbTest.rows[0].current_time.toISOString()} \`
Total records in \`user_status\`: \`${dbTest.rows[0].total_records}\`
Active records: \`${dbTest.rows[0].active_records}\`
A test status was also inserted/updated for your ID.`;
            
        } catch (error) {
            console.error('Database operation failed during DEBUG MODE test:', error);
            replyContent = `❌ Database test failed!
Error: \` ${error.message} \`
Check bot logs on Render for full details.`;
        }
        
        // Always respond to the interaction after the deferral using editReply
        await interaction.editReply({ content: replyContent });
    },
};
