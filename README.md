# GateKeep

Telegram bot for gated access to creator DMs, powered by [Doppler Protocol](https://doppler.lol) on Base.

Creators lock conversations behind a token market cap threshold. Fans pump the token to unlock. Every trade generates fees for the creator.

## how it works

1. Creator DMs the bot and runs `/setup` to connect their Base wallet
2. Creator runs `/lock`, picks a threshold ($5k, $10k, $50k)
3. A token launches instantly on Base via Doppler's multicurve auction
4. Creator sends the CA to the fan
5. Fan pumps the token. When market cap hits the threshold, DMs unlock
6. Creator earns trading fees on every trade via Doppler fee rehypothecation

## stack

- **Runtime**: Node.js + TypeScript
- **Bot**: [grammY](https://grammy.dev) (Telegram Bot API)
- **Chain**: Base (EVM)
- **Protocol**: [Doppler](https://doppler.lol) multicurve auctions, fee rehypothecation
- **Database**: PostgreSQL
- **Web**: Express (health check, token metadata, landing page)

## setup

```bash
cp .env.example .env
npm install
npm run dev
```

### environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `DATABASE_URL` | PostgreSQL connection string |
| `SERVER_PRIVATE_KEY` | Private key for server-side token deployment (0x...) |
| `BASE_RPC_URL` | Base RPC endpoint (defaults to https://mainnet.base.org) |
| `APP_URL` | Public URL for token metadata (defaults to https://gatekeep.xyz) |
| `DOPPLER_INDEXER_URL` | Doppler indexer for market cap lookups |
| `WEBHOOK_URL` | Optional. If set, uses webhook mode instead of long polling |
| `PORT` | Web server port (defaults to 3000) |

## commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/setup` | Connect Twitter and Base wallet |
| `/lock` | Gate a DM conversation with a token |
| `/status` | View all locked chats and progress |

## brand

- **Name**: GateKeep
- **Primary pink**: `#FF2D8A`
- **Primary black**: `#0A0A0A`
- **Accent pink**: `#FF69B4`
- **Tone**: internet-native, cheeky, exclusive

## license

MIT
