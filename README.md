# cloudflare telegram bot

cloudflare telegram bot is a powerful Telegram bot designed to streamline Cloudflare DNS management through an intuitive interface. It enables users to efficiently manage Cloudflare API tokens and DNS records with simple commands.

## Key Features

### Authentication & Security
- Secure user authentication system
- Admin password protection
- Secret token validation
- Session management

### Cloudflare Management
- **API Token Operations:**
    - Add new API tokens with custom names
    - List all stored API tokens
    - Delete existing API tokens
    - Validate token authenticity
- **DNS Management:**
    - Add new DNS records
    - Record validation

### Bot Features
- Interactive menu system
- Operation cancellation
- Chat history management
- Error handling with user feedback
- Webhook support for reliable communication

## Technical Requirements

### System Requirements
- Node.js (v14.x or higher)
- npm (v6.x or higher)
- Available ports for webhook
- SSL certificate (for webhook HTTPS)

### Required Credentials
- Telegram Bot Token (from @BotFather)
- Cloudflare API Token (with DNS edit permissions)
- Admin password for bot management

### Environment Setup

1. Clone the repository:
        ```sh
        git clone https://github.com/emailing-solution/cloudflare_telegram_bot.git
        cd cloudflare_telegram_bot
        ```

2. Install dependencies:
        ```sh
        npm install
        ```

3. Configure environment variables in `.env`:
        ```properties
        BOT_TOKEN="your-telegram-bot-token"
        ADMIN_PASSWORD="your-admin-password"
        WEBHOOK_DOMAIN="your-webhook-domain"
        WEBHOOK_PORT="your-webhook-port"
        WEBHOOK_PATH="your-webhook-path"
        SECRET_TOKEN="your-secret-token"
        ```

4. Start the service:
        ```sh
        npm start
        ```

## Command Reference

### User Commands
- `/start` - Initialize bot and begin authentication
- `/clear` - Purge chat history
- `/cancel` - Abort current operation
- `/help` - Display command list

### Interactive Features
- Main menu navigation
- Token management interface
- DNS record configuration wizard
- Status notifications
- Error messages

## System Architecture

### Components
- Telegram Bot API integration
- Cloudflare API client
- Webhook server
- Database management
- Logging system

### Logging System
- Location: `./logs` directory
- Format: Daily rotating files
- Content: Operations, errors, user actions

## Error Management
- Comprehensive error catching
- User-friendly error messages
- Detailed error logging
- Automatic error recovery

## Performance
- Asynchronous operations
- Connection pooling
- Rate limiting compliance
- Memory optimization

## Security Features
- Input validation
- Token encryption
- Session timeout
- Request validation

## License
Released under MIT License
Copyright © 2025

## Support
For issues and feature requests, please use the GitHub issue tracker.