name 'ai-prison'
author 'TGIANN'
version '0.2.0' -- x-release-please-version
license 'GPL-3.0-only'
description 'Jail sentences counted by the server: confiscated items, prison work that shortens the sentence, canteen, escape check, release point'
repository 'https://github.com/aifivem/ai-prison'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/tasks.json',
}
