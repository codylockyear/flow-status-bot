const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const dotenv = require('dotenv'); // Using dotenv for environment variables

dotenv.config();

const commands = [
    new SlashCommandBuilder()
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
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Replace GUILD_ID with your specific guild ID for testing
        // For global commands, use Routes.applicationCommands(CLIENT_ID)
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
