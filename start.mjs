import TelegramBot from 'node-telegram-bot-api';
import { config as loadEnv } from 'dotenv-flow';

loadEnv();

const {
	FETCH_INTERVAL,
	API_URL,
	TOKEN,
	CHAT_ID,
	SAUNA_TEMPERATURE_OFFSET,
	SAUNA_WARM_TEMPERATURE,
	SAUNA_WARM_TEMPERATURE_RESET,
	SAUNA_PAIN_LIMIT
} = process.env;

// Testing constant so no need to type the process.env.NODE_ENV === "test" all the time.
const TESTING = (process.env.NODE_ENV === "test");

const telegram = new TelegramBot(TOKEN, { polling: false });

let sauna_warm = false;
let sauna_temperature = 0;
let sauna_pain = false;

// NODE_ENV="test" stuff.
let test_temperature = 35;
let test_temperature_step = 8;

async function main() {
	sauna_temperature = await getSaunaTemperature();

	// For testing purposes we will increase and decrease temperature and replace the production variable.
	if (TESTING) {
		test_temperature = test_temperature + test_temperature_step;

		if (test_temperature <= 20) {
			test_temperature_step = 8
		}
		else if (test_temperature >= 80) {
			test_temperature_step = -8;
		}

		sauna_temperature = test_temperature;
	}

	console.log('-----');
	console.log('Checking if sauna is warm.');
	console.log('Sauna\'s temperature is ' + (sauna_temperature) + '°C.');

	if (!sauna_warm && sauna_temperature >= SAUNA_WARM_TEMPERATURE) {
		sauna_warm = true;
		await sendMessage('🔥 Hirvihuhdan sauna on lämmin, saunassa on ehkä ' + (sauna_temperature + Number(SAUNA_TEMPERATURE_OFFSET)) + '°C');
		console.log('Sauna is now warm.');
	}
	else if (sauna_warm && !sauna_pain && sauna_temperature >= SAUNA_PAIN_LIMIT) {
		sauna_pain = true;
		await sendMessage('💀 Hirvihuhdan saunassa on siirrytty kipurajan yli');
		console.log('Pain limit reached.');
	}
	else if (sauna_warm && sauna_temperature <= SAUNA_WARM_TEMPERATURE_RESET) {
		sauna_warm = false;
		sauna_pain = false;
		console.log('Sauna isn\'t warm, sensor ' + sauna_temperature + '°C.');
	}

	console.log('Sauna ' + (sauna_warm ? 'is warm' : 'isn\'t warm.'));
}

async function getSaunaTemperature() {
	const response = await fetch(API_URL);
	const response_json = await response.json();
	const sauna = response_json.find(entry => entry.tag_name === 'Sauna');
	//const temperature = sauna.temperature + SAUNA_TEMPERATURE_OFFSET;
	const temperature = sauna.temperature.current;

	if (isNaN(temperature)) {
		throw new Exception("Invalid data from API.");
	}

	return temperature;
}

// Message sending handling.
async function sendMessage(message) {
	console.log('Message to Telegram: ' + message);

	if (!TESTING) {
		await telegram.sendMessage(CHAT_ID, message);
	}
}

// Initial run on start-up. Unnecessary but good for testing.
await main();

// Start the interval loop.
setInterval(async () => {
	// This will make sure that the loop gets looping although there might be an error.
	try {
		await main();
	}
	catch (error) {
		// Log the possible error.
		console.log(error);
	}
}, FETCH_INTERVAL);
