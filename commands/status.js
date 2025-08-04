const { SlashCommandBuilder } = require(\'discord.js\');
const db = require(\'../db\'); // Import your database connection module

// Function to clean a nickname, removing bot-added status tags (kept for completeness, though not used in this test version)
function cleanNickname(name) {
    const statusPattern = /\\\\s\\\\[(creative-flow|client-work|available|busy|break)\\\\\\\\]$/i;
    return name.replace(statusPattern, \'\').trim();
}

module.exports = {
    // Define the slash command data
    data: new SlashCommandBuilder()
        .setName(\'status\')
        .setDescription(\'Set your custom status or view current status (DEBUG MODE).\')
        .addStringOption(option =>
            option.setName(\'status\')
                .setDescription(\'Your desired status (ignored in DEBUG MODE)\')
                .setRequired(false)
                .addChoices(
                    { name: \'Creative Flow\', value: \'creative-flow\' },
                    { name: \'Client Work\', value: \'client-work\' },
                    { name: \'Available\', value: \'available\' },
                    { name: \'Busy\', value: \'busy\' },
                    { name: \'Break\', value: \'break\' },
                )),

    // Execute function for when the command is called
    async execute(interaction) {
        // Defer the reply to give more time for database operations
        await interaction.deferReply({ ephemeral: true }); 

        let replyContent = \'\';

        try {
            console.log(\'Executing database status check (DEBUG MODE)...\');
            
            // Simple database test - just check connection and get basic info
            const dbTest = await db.query(`
                SELECT 
                    NOW() as current_time,
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_records
                FROM user_status
            `);
            
            console.log(\'Database query successful:\', dbTest.rows[0]);
            
            // Try to insert a status record (simple INSERT, no conflicts)
            const testUserId = interaction.user.id;
            const testGuildId = interaction.guild ? interaction.guild.id : \'dm-test\'; // Use guild ID for test
            
            // Attempt to insert a test status, overriding any existing one for this test
            await db.query(`
                INSERT INTO user_status (user_id, guild_id, status, timestamp, expires_at)
                VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL \'1 hour\')
                ON CONFLICT (user_id, guild_id, timestamp) DO UPDATE SET
                status = EXCLUDED.status, expires_at = EXCLUDED.expires_at;
            `, [testUserId, testGuildId, \'creative-flow-test\']);
            
            console.log(\'Status test record inserted/updated for user:\', testUserId);

            replyContent = `✅ Database test successful!
Connected. Current DB time: \` ${dbTest.rows[0].current_time.toISOString()} \`
Total records in \`user_status\`: \`${dbTest.rows[0].total_records}\`
Active records: \`${dbTest.rows[0].active_records}\`
A test status was also inserted/updated for your ID.`;
            
        } catch (error) {
            console.error(\'Database operation failed during DEBUG MODE test:\', error);
            
            // If it\'s a duplicate key error, that\'s actually fine for this test INSERT, but my added ON CONFLICT handles it.
            // The primary goal is to report the error and not crash.
            replyContent = `❌ Database test failed!
Error: \` ${error.message} \`
Check bot logs on Render for full details.`;
        }
        
        // Always respond to the interaction after the deferral
        await interaction.editReply({ content: replyContent });
    },
};
