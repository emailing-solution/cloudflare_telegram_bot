import { Telegraf, Markup } from 'telegraf';
import { CloudflareManager } from './CloudflareManager.js';
import { Logger } from './Logger.js';
import { UserManager } from './UserManager.js';
import { MessageQueue } from './MessageQueue.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const userManager = new UserManager();
const cloudflare = new CloudflareManager();
const logger = new Logger();
const messageQueue = new MessageQueue(bot, logger);

// Update checkAuth function
async function checkAuth(ctx) {
    const chatId = ctx.chat.id;
    const isAuthed = userManager.isAuthenticated(chatId);
    
    if (!isAuthed) {
        await ctx.reply('⚠️ Please authenticate first!');
        await ctx.reply('Enter your password:');
        userManager.setState(chatId, 'AWAIT_PASSWORD');
        return false;
    }
    return true;
}

// Add this helper function near other utility functions
async function clearChat(ctx) {
    const chatId = ctx.chat.id;
    try {
        // Get current message ID
        const currentMessageId = ctx.message.message_id;
        
        // Delete all messages up to current one
        for (let i = currentMessageId; i > currentMessageId - 100; i--) {
            try {
                await ctx.telegram.deleteMessage(chatId, i);
            } catch (err) {
                // Ignore errors for messages that don't exist or are already deleted
                break;
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    } catch (err) {
        logger.logError(`Error clearing chat: ${err.message}`);
    }
}

// Command handlers
bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    
    if (userManager.isAuthenticated(chatId)) {
        await ctx.reply('Welcome back! 🤡');
        await showMainMenu(ctx);
    } else {
        await ctx.reply('Welcome LHADDAD 🤡🤡🤡! enter your password:');
        userManager.setState(chatId, 'AWAIT_PASSWORD');
    }
});

//clear command
bot.command('clear', async (ctx) => {
    await clearChat(ctx);
});

// Add this after other bot commands
bot.command('cancel', async (ctx) => {
    await handleCancel(ctx);
});

bot.action('cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCancel(ctx);
});

// Message handlers
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    if (text.toLowerCase() === '/cancel') {
        await handleCancel(ctx);
        return;
    }

    const currentState = userManager.getState(chatId);

    try {
        switch (currentState) {
            case 'AWAIT_PASSWORD':
                if (text.toUpperCase() === process.env.ADMIN_PASSWORD) {
                    logger.logAction(chatId, 'AUTH_SUCCESS');
                    userManager.setAuthenticated(chatId, true);
                    await ctx.reply('Authentication successful!');
                    await showMainMenu(ctx);
                } else {
                    logger.logAction(chatId, 'AUTH_FAIL', text);
                    await ctx.reply('Invalid password. Try again:');
                }
                break;

            case 'AWAIT_TOKEN_NAME':
                if (!text.trim()) {
                    await ctx.reply('❌ Token name cannot be empty. Please try again:');
                    return;
                }
                userManager.setTemp(chatId, 'token_name', text);
                userManager.setState(chatId, 'AWAIT_API_TOKEN');
                await ctx.reply('Enter the Cloudflare API Token:');
                break;

            case 'AWAIT_API_TOKEN':
                if (!text.trim()) {
                    await ctx.reply('❌ API Token cannot be empty. Please try again:');
                    return;
                }
                try {
                    const tokenName = userManager.getTemp(chatId, 'token_name');
                    const tokenId = userManager.addApiToken(chatId, text, tokenName);
                    logger.logAction(chatId, 'ADD_API_TOKEN', `Name: ${tokenName}`);
                    userManager.setState(chatId, 'MAIN_MENU');
                    await ctx.reply(`✅ API Token '${tokenName}' saved successfully!`);
                    await showMainMenu(ctx);
                } catch (err) {
                    logger.logError(`Error adding API token: ${err.message}`);
                    await ctx.reply('❌ Failed to save API token. Please try again:');
                }
                break;

            case 'AWAIT_SUBDOMAIN':
                if (!/^[@*a-zA-Z0-9.-]+$/.test(text)) {
                    await ctx.reply('❌ Invalid subdomain format! Please try again:');
                    return;
                }
                userManager.setTemp(chatId, 'subdomain', text);
                userManager.setState(chatId, 'AWAIT_IP');
                await ctx.reply('Enter the IP address for the subdomain:');
                break;

            case 'AWAIT_IP':
                if (!isValidIPv4(text)) {
                    await ctx.reply('❌ Invalid IPv4 address! Please try again:');
                    return;
                } else if (isPrivateIP(text)) {
                    await ctx.reply('⚠️ Private IPs are not allowed. Enter a public IP:');
                    return;
                }
                try {
                    await processDNSRecords(ctx, text);
                } catch (err) {
                    logger.logError(`Error processing DNS records: ${err.message}`);
                    await ctx.reply('❌ Failed to process DNS records. Would you like to try again?');
                    const retryKeyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('🔄 Try Again', 'add_dns')],
                        [Markup.button.callback('🏠 Main Menu', 'show_menu')]
                    ]);
                    await ctx.reply('Choose an option:', retryKeyboard);
                }
                break;

            default:
                await showMainMenu(ctx);
        }
    } catch (err) {
        logger.logError(`Error processing text handler: ${err.message}`, err.stack);
        await ctx.reply('❌ An error occurred. Returning to main menu...');
        await showMainMenu(ctx);
    }
});

// Callback query handlers
bot.action('add_token', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        userManager.setState(ctx.chat.id, 'AWAIT_TOKEN_NAME');
        await ctx.reply('Enter a name for the API token:');
    } catch (err) {
        logger.logError(`Error in add_token handler: ${err.message}`);
    }
});

bot.action('list_tokens', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        const tokens = userManager.getApiTokens(ctx.chat.id);
        
        if (Object.keys(tokens).length === 0) {
            await ctx.reply('No API tokens found. Add one first!');
            await showMainMenu(ctx);
            return;
        }

        // Create token list keyboard
        const keyboard = Object.entries(tokens).map(([id, data]) => [
            Markup.button.callback(`✅ ${data.name}`, `select_token:${id}`),
            Markup.button.callback(`🗑️ ${data.name}`, `delete_token:${id}`),            
        ]);

        // First show tokens list
        await ctx.reply('Your API Tokens:', Markup.inlineKeyboard(keyboard));

        // Then show main menu separately
        await showMainMenu(ctx);
    } catch (err) {
        logger.logError(`Error in list_tokens handler: ${err.message}`);
        await showMainMenu(ctx);
    }
});

bot.action('add_dns', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        const tokens = userManager.getApiTokens(ctx.chat.id);
        
        if (Object.keys(tokens).length === 0) {
            await ctx.reply('Please add an API token first!');
            await showMainMenu(ctx); // Show menu when no tokens
            return;
        }

        if (!userManager.getTemp(ctx.chat.id, 'selected_token')) {
            await ctx.reply('Please select an API token first!');
            const keyboard = Object.entries(tokens).map(([id, data]) => [
                Markup.button.callback(`✅ ${data.name}`, `select_token:${id}`)
            ]);
            await ctx.reply('Select a token:', Markup.inlineKeyboard(keyboard));
            await showMainMenu(ctx); // Show menu after token selection prompt
            return;
        }

        userManager.setState(ctx.chat.id, 'AWAIT_SUBDOMAIN');
        await ctx.reply('👻 👻 Using Selected account: ' + tokens[userManager.getTemp(ctx.chat.id, 'selected_token')].name);
        await ctx.reply('Enter the subdomain (use @ for root domain, * for wildcard):');
    } catch (err) {
        logger.logError(`Error in add_dns handler: ${err.message}`);
        await showMainMenu(ctx);
    }
});

bot.action(/^delete_token:(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        const tokenId = ctx.match[1];
        if (userManager.removeApiToken(ctx.chat.id, tokenId)) {
            await ctx.reply('✅ Token deleted successfully!');
        } else {
            await ctx.reply('❌ Failed to delete token.');
        }
        // Remove the call to list_tokens and just show main menu
        await showMainMenu(ctx);
    } catch (err) {
        logger.logError(`Error in delete_token handler: ${err.message}`);
        await showMainMenu(ctx);
    }
});

bot.action(/^select_token:(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        const tokenId = ctx.match[1];
        const token = userManager.getApiToken(ctx.chat.id, tokenId);
        if (token) {
            userManager.setTemp(ctx.chat.id, 'selected_token', tokenId);
            await ctx.reply(`✅ Token selected successfully!`);
            await showMainMenu(ctx);
        } else {
            await ctx.reply('❌ Invalid token.');
        }
    } catch (err) {
        logger.logError(`Error in select_token handler: ${err.message}`);
    }
});

// Add new callback handler for showing menu
bot.action('show_menu', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        if (!await checkAuth(ctx)) return;
        await showMainMenu(ctx);
    } catch (err) {
        logger.logError(`Error showing menu: ${err.message}`);
        await ctx.reply('❌ Failed to show menu. Please try /start to restart.');
    }
});



// Replace processDNSRecords function
async function processDNSRecords(ctx, ip) {
    const chatId = ctx.chat.id;
    
    if (userManager.isProcessing(chatId)) {
        await ctx.reply('⚠️ A process is already running. Use /cancel to stop it first.');
        return;
    }

    const selectedTokenId = userManager.getTemp(chatId, 'selected_token');
    const selectedToken = userManager.getApiToken(chatId, selectedTokenId);

    if (!selectedToken) {
        await ctx.reply('❌ No token selected. Please select a token first.');
        await showMainMenu(ctx);
        return;
    }

    cloudflare.setApiToken(selectedToken);
    userManager.setProcessing(chatId, true);

    // Create an AbortController for cancellation
    const abortController = new AbortController();
    userManager.setTemp(chatId, 'abortController', abortController);

    // Create inline keyboard for cancel
    const cancelKeyboard = Markup.inlineKeyboard([
        Markup.button.callback('❌ Cancel Operation', 'cancel')
    ]);

    try {
        const statusMessage = await ctx.reply('🔍 Fetching domains...', cancelKeyboard);
        const domains = await cloudflare.getDomains();
        
        if (!domains.length) {
            throw new Error('No domains found for this API token!');
        }

        const subdomainValue = userManager.getTemp(chatId, 'subdomain');
        const total = domains.length;
        let processed = 0;
        let success = 0;
        let failed = 0;
        let results = [];
        let lastUpdateTime = Date.now();
        let progressMessage = '';

        // Throttled status update function
        const updateStatus = async (force = false) => {
            const now = Date.now();
            if (force || now - lastUpdateTime >= 3000) { // Update every 3 seconds
                const progress = ((processed / total) * 100).toFixed(1);
                const newMessage = 
                    `📊 Progress: ${progress}%\n` +
                    `✅ Successful: ${success}\n` +
                    `❌ Failed: ${failed}\n` +
                    `⏳ Remaining: ${total - processed}\n\n` +
                    `${progressMessage}`;

                try {
                    await ctx.telegram.editMessageText(
                        chatId,
                        statusMessage.message_id,
                        null,
                        newMessage,
                        { parse_mode: 'HTML', ...cancelKeyboard }
                    );
                    lastUpdateTime = now;
                } catch (err) {
                    // Ignore edit conflicts
                }
            }
        };

        // Process domains in batches
        const batchSize = 5;
        for (let i = 0; i < domains.length; i += batchSize) {
            if (abortController.signal.aborted) {
                throw new Error('Operation cancelled by user');
            }

            const batch = domains.slice(i, i + batchSize);
            const batchPromises = batch.map(async domain => {
                try {
                    // Add timeout to each DNS operation
                    const result = await Promise.race([
                        cloudflare.createDNSRecord(domain, subdomainValue, ip),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), 20000)
                        )
                    ]);

                    success++;
                    return `✅ ${subdomainValue}.${domain} -> ${ip}`;
                } catch (err) {
                    failed++;
                    return `❌ ${domain}: ${err.message}`;
                } finally {
                    processed++;
                }
            });

            // Process batch results
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Update progress message with latest results
            progressMessage = results.slice(-5).join('\n'); // Show last 5 results
            await updateStatus();

            // Send full results every 20 domains
            if (results.length >= 20) {
                const chunks = splitMessage(results.join('\n'));
                for (const chunk of chunks) {
                    await messageQueue.add(chatId, chunk);
                }
                results = [];
            }

            // Add small delay between batches to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Send remaining results
        if (results.length > 0) {
            const chunks = splitMessage(results.join('\n'));
            for (const chunk of chunks) {
                await messageQueue.add(chatId, chunk);
            }
        }

        await updateStatus(true);
        await messageQueue.add(chatId, `✅ Operation completed!\nTotal: ${total}\nSuccess: ${success}\nFailed: ${failed}`);
        
        // Send completion GIF
        const gifPath = './success.gif';
        await ctx.replyWithAnimation({ source: gifPath }, {
            caption: '🎉 All DNS records have been processed!'
        });

    } catch (err) {
        await ctx.reply(`❌ Error: ${err.message}`);
    } finally {
        userManager.setProcessing(chatId, false);
        userManager.setTemp(chatId, 'abortController', null);
        await showMainMenu(ctx);
    }
}

// Add deleteOldMenu helper function
async function deleteOldMenu(ctx) {
    const chatId = ctx.chat.id;
    const oldMessageId = userManager.getMenuMessageId(chatId);
    if (oldMessageId) {
        try {
            await ctx.telegram.deleteMessage(chatId, oldMessageId);
        } catch (err) {
            // Ignore errors when message is already deleted
        }
        userManager.setMenuMessageId(chatId, null);
    }
}

// Modify handleCancel function
async function handleCancel(ctx) {
    const chatId = ctx.chat.id;
    const abortController = userManager.getTemp(chatId, 'abortController');
    
    if (abortController) {
        abortController.abort();
    }
    
    userManager.setState(chatId, 'MAIN_MENU');
    userManager.setProcessing(chatId, false);
    userManager.clearTemp(chatId);
    await ctx.reply('✅ Operation cancelled.');
    await showMainMenu(ctx);
}

// Replace the showMainMenu function
async function showMainMenu(ctx) {
    try {
        await deleteOldMenu(ctx);
        
        const chatId = ctx.chat.id;
        const currentState = userManager.getState(chatId);
        const buttons = [
            [Markup.button.callback('➕ Add API Token', 'add_token')],
            [Markup.button.callback('🔑 Manage API Tokens', 'list_tokens')],
            [Markup.button.callback('🌐 Add DNS Record', 'add_dns')],
        ];

        // Add cancel button if not in main menu
        if (currentState !== 'MAIN_MENU') {
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);
        }

        const keyboard = Markup.inlineKeyboard(buttons);
        const menuMessage = await ctx.reply('Main Menu:', keyboard);
        userManager.setMenuMessageId(chatId, menuMessage.message_id);
    } catch (err) {
        logger.logError(`Error in showMainMenu: ${err.message}`);
    }
}

function isValidIPv4(ip) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(num => parseInt(num) <= 255);
}

function isPrivateIP(ip) {
    const privateRanges = [
        ['10.0.0.0', '10.255.255.255'],
        ['172.16.0.0', '172.31.255.255'],
        ['192.168.0.0', '192.168.255.255'],
    ];

    const ipLong = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
    return privateRanges.some(([start, end]) => {
        const startLong = start.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
        const endLong = end.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
        return ipLong >= startLong && ipLong <= endLong;
    });
}

// Update splitMessage function
function splitMessage(text, maxLength = 4000) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    let currentChunk = '';
    let currentLength = 0;

    const lines = text.split('\n');
    for (const line of lines) {
        if (currentLength + line.length + 1 > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
                currentLength = 0;
            }
            
            // Handle long lines
            if (line.length > maxLength) {
                const parts = Math.ceil(line.length / maxLength);
                for (let i = 0; i < parts; i++) {
                    chunks.push(line.substr(i * maxLength, maxLength));
                }
                continue;
            }
        }
        
        currentChunk += (currentLength > 0 ? '\n' : '') + line;
        currentLength += line.length + 1;
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

// Error handler
bot.catch((err, ctx) => {
    logger.logError(`Error for ${ctx.updateType}: ${err.message}`);
});

// Start bot
bot.launch({
    webhook: {
        domain: process.env.WEBHOOK_DOMAIN,
        port: parseInt(process.env.WEBHOOK_PORT),
        path: process.env.WEBHOOK_PATH,
        secretToken: process.env.SECRET_TOKEN
    }
})
    .then(() => logger.log('Bot started successfully'))
    .catch(err => logger.logError('Bot failed to start', err.message));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
