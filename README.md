# Blus Stupid NHL Bot

A Discord bot that posts Toronto Maple Leafs game updates to a designated channel. Get real-time score updates, period changes, and game results during Leafs games!

## Features

<<<<<<< HEAD
=======
## Features

>>>>>>> 63dde3e99d6bfc100673bafeddafaa425d0779a3
- 🏒 Real-time Toronto Maple Leafs game updates
- 🚨 Goal notifications with team logos and score details
- 🔄 Period change notifications
- 🏁 Final game result announcements
- 📅 Check the next scheduled Leafs game

## Setup Instructions

### Prerequisites

1. [Create a Discord application](https://discord.com/developers/applications)
2. Enable the bot user for your application
3. Get your application ID and bot token from the Discord Developer Portal
<<<<<<< HEAD
4. Make sure your bot has the following Privileged Gateway Intents enabled:
   - Message Content Intent
   - Server Members Intent
=======
4. Generate a public key for your application
>>>>>>> 63dde3e99d6bfc100673bafeddafaa425d0779a3

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   APP_ID=your_app_id
   DISCORD_TOKEN=your_bot_token
<<<<<<< HEAD
   ```

### Inviting the Bot to Your Server

1. In the [Discord Developer Portal](https://discord.com/developers/applications), select your application
2. Go to "OAuth2" > "URL Generator"
3. Select the following scopes:
   - `bot`
   - `applications.commands`
4. Select the following bot permissions:
   - "Send Messages"
   - "Embed Links"
   - "Read Message History"
   - "Use Slash Commands"
5. Copy the generated URL and paste it in your browser
6. Select your Discord server and authorize the bot

### Running the Bot

1. Register the slash commands with Discord:
   ```
   npm run deploy
=======
   PUBLIC_KEY=your_public_key
   ```

### Running the Bot

1. Register the commands with Discord:
   ```
   npm run register
>>>>>>> 63dde3e99d6bfc100673bafeddafaa425d0779a3
   ```
2. Start the bot:
   ```
   npm start
   ```

## Discord Commands

- `/setup-leafs-updates` - Configure which channel to post Maple Leafs game updates to
- `/stop-leafs-updates` - Stop posting game updates in this server
- `/next-leafs-game` - Get information about the next Toronto Maple Leafs game
- `/test` - Basic test command to check if the bot is working

## How It Works

The bot checks the NHL API every minute during Maple Leafs games to detect:
- Score changes
- Period changes
- Game start/end

When an update is detected, the bot posts a formatted message to the configured channel with details about the current game status.

## Project Structure

```
blus-stupid-NHL-bot/
<<<<<<< HEAD
├── index.js           # Main Discord.js bot file
├── deploy-commands.js # Command registration script
├── nhl-api.js         # NHL API integration functions
├── .env               # Environment variables (create this yourself)
=======
├── app.js             # Main application entry point
├── commands.js        # Discord slash command definitions
├── nhl-api.js         # NHL API integration functions
├── leafs-updates.js   # Game update tracking and notification system
├── utils.js           # Utility functions
>>>>>>> 63dde3e99d6bfc100673bafeddafaa425d0779a3
└── package.json       # Project dependencies
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
├── examples    -> short, feature-specific sample apps
│   ├── app.js  -> finished app.js code
│   ├── button.js
│   ├── command.js
│   ├── modal.js
│   ├── selectMenu.js
├── .env.sample -> sample .env file
├── app.js      -> main entrypoint for app
├── commands.js -> slash command payloads + helpers
├── game.js     -> logic specific to RPS
├── utils.js    -> utility functions and enums
├── package.json
├── README.md
└── .gitignore
```

## Running app locally

Before you start, you'll need to install [NodeJS](https://nodejs.org/en/download/) and [create a Discord app](https://discord.com/developers/applications) with the proper permissions:
- `applications.commands`
- `bot` (with Send Messages enabled)


Configuring the app is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

### Setup project

First clone the project:
```
git clone https://github.com/discord/discord-example-app.git
```

Then navigate to its directory and install dependencies:
```
cd discord-example-app
npm install
```
### Get app credentials

Fetch the credentials from your app's settings and add them to a `.env` file (see `.env.sample` for an example). You'll need your app ID (`APP_ID`), bot token (`DISCORD_TOKEN`), and public key (`PUBLIC_KEY`).

Fetching credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

> 🔑 Environment variables can be added to the `.env` file in Glitch or when developing locally, and in the Secrets tab in Replit (the lock icon on the left).

### Install slash commands

The commands for the example app are set up in `commands.js`. All of the commands in the `ALL_COMMANDS` array at the bottom of `commands.js` will be installed when you run the `register` command configured in `package.json`:

```
npm run register
```

### Run the app

After your credentials are added, go ahead and run the app:

```
node app.js
```

> ⚙️ A package [like `nodemon`](https://github.com/remy/nodemon), which watches for local changes and restarts your app, may be helpful while locally developing.

If you aren't following the [getting started guide](https://discord.com/developers/docs/getting-started), you can move the contents of `examples/app.js` (the finished `app.js` file) to the top-level `app.js`.

### Set up interactivity

The project needs a public endpoint where Discord can send requests. To develop and test locally, you can use something like [`ngrok`](https://ngrok.com/) to tunnel HTTP traffic.

Install ngrok if you haven't already, then start listening on port `3000`:

```
ngrok http 3000
```

You should see your connection open:

```
Tunnel Status                 online
Version                       2.0/2.0
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://1234-someurl.ngrok.io -> localhost:3000

Connections                  ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

Copy the forwarding address that starts with `https`, in this case `https://1234-someurl.ngrok.io`, then go to your [app's settings](https://discord.com/developers/applications).

On the **General Information** tab, there will be an **Interactions Endpoint URL**. Paste your ngrok address there, and append `/interactions` to it (`https://1234-someurl.ngrok.io/interactions` in the example).

Click **Save Changes**, and your app should be ready to run 🚀

## Other resources
- Read **[the documentation](https://discord.com/developers/docs/intro)** for in-depth information about API features.
- Browse the `examples/` folder in this project for smaller, feature-specific code examples
- Join the **[Discord Developers server](https://discord.gg/discord-developers)** to ask questions about the API, attend events hosted by the Discord API team, and interact with other devs.
- Check out **[community resources](https://discord.com/developers/docs/topics/community-resources#community-resources)** for language-specific tools maintained by community members.
