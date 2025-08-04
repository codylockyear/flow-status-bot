const { SlashCommandBuilder } = require('discord.js');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check bot and database status'),
    
    async execute(interaction) {
        try {
            // Test database connection
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as current_time');
            client.release();
            
            await interaction.editReply({
                embeds: [{
                    color: 0x00ff00,
                    title: '🤖 Bot Status',
                    fields: [
                        {
                            name: '📡 Bot',
                            value: '✅ Online',
                            inline: true
                        },
                        {
                            name: '🗄️ Database',
                            value: '✅ Connected',
                            inline: true
                        },
                        {
                            name: '⏰ Database Time',
                            value: result.rows[0].current_time.toLocaleString(),
                            inline: false
                        }
                    ],
                    timestamp: new Date()
                }]
            });
            
        } catch (error) {
            console.error('Status command error:', error);
            
            await interaction.editReply({
                embeds: [{
                    color: 0xff0000,
                    title: '🤖 Bot Status',
                    fields: [
                        {
                            name: '📡 Bot',
                            value: '✅ Online',
                            inline: true
                        },
                        {
                            name: '🗄️ Database',
                            value: '❌ Connection Failed',
                            inline: true
                        },
                        {
                            name: '❌ Error',
                            value: error.message,
                            inline: false
                        }
                    ],
                    timestamp: new Date()
                }]
            });
        }
    }
};