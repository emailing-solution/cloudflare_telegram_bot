export class MessageQueue {
    constructor(bot, logger) {
        this.bot = bot;
        this.logger = logger;
        this.queues = new Map();
        this.processing = new Map();
    }

    async add(chatId, message, options = {}) {
        if (!this.queues.has(chatId)) {
            this.queues.set(chatId, []);
            this.processing.set(chatId, false);
        }

        this.queues.get(chatId).push({ message, options });
        await this.process(chatId);
    }

    async process(chatId) {
        if (this.processing.get(chatId)) return;
        this.processing.set(chatId, true);

        while (this.queues.get(chatId).length > 0) {
            const { message, options } = this.queues.get(chatId)[0];
            try {
                await this.bot.telegram.sendMessage(chatId, message, options);
                await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit protection
            } catch (error) {
                this.logger.logError(`Failed to send message: ${error.message}`);
            }
            this.queues.get(chatId).shift();
        }

        this.processing.set(chatId, false);
    }
}