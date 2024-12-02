require('dotenv').config();
const axios = require('axios').default;
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const Bottleneck = require("bottleneck/es5");

// var mailgun = require('mailgun-js')({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});

/*
http://api.tvmaze.com/shows/50415/episodesbydate?date=2024-12-01
*/

const tvMazeBaseUrl = `http://api.tvmaze.com`;

const getAiringToDay = async (id, date) => {
	// http://api.tvmaze.com/shows/7186/episodesbydate?date=2021-04-09
	// http://api.tvmaze.com/shows/329/episodesbydate?date=2021-04-09
	// console.log('url is', `${tvMazeBaseUrl}/shows/${id}/episodesbydate?date=${date}`);
	try {
		const response = await axios({
			method: 'GET',
			// /shows/329/episodesbydate?date=2021-04-09
			url: `${tvMazeBaseUrl}/shows/${id}/episodesbydate?date=${date}`,
		});

		return response.data[0];
	} catch (e) {
		if(e.code !== undefined && e.code !== 404) {
			console.error('Exception in getAiringToDay'); //, e);
		} else {
			// console.log('no panic, just no episodes for today 😊');
		}

		return undefined;
	}
}

const getSeriesDetails = async (id) => {
	try {
		const response = await axios({
			method: 'GET',
			url: `${tvMazeBaseUrl}/shows/${id}`,
		});

		return {
			name: response.data.name,
			image: response.data.image.medium,
		}
		// let html = `<h1>${response.data.name}</h1>`;
		// html += `<img src='${response.data.image.medium}' />`
		// return html;
	} catch (e) {
		console.error('Exception in getSeriesDetails'); //, e);

		return undefined;
	}
}

const formatEpisodeAsHtml = async (seriesId, episodeData) => {
	let seriesDetails = await getSeriesDetails(seriesId);
	let summary = "";

	// console.log({seriesDetails})
	// console.log({episodeData})

	
	if(episodeData.summary != null) {
		summary = episodeData.summary;
	} 

	let html = '';
	html += `${seriesDetails.name}\r\n`;

	if(episodeData.season != null) {
		html += "#S" + episodeData.season;
	}

	if(episodeData.number != null) {
		html += "E" + episodeData.number + "\r\n";
	}

	if(summary != null) {
			html += summary.trim() + "\r\n"
	}

	html += `------------------------\r\n`;

	// if(seriesDetails !== undefined) {
	// 	html += `${seriesDetails.name}\r\n`;
	// 	html += `------------------------\r\n`;
	// 	html += `#${episodeData.number}: ${summay.trim()}\r\n`
	// } else {
	// 	html = `There is new episode for ${seriesId}: ${episodeData}, but could not get series details???\r\n`;
	// }

	// console.log({html})
	return html;


	if(seriesDetails !== undefined) {
		html = `<table><tr><td><h1 width="50%">${seriesDetails.name}</h1></td><td width="50%"><img src="${seriesDetails.image}" /></td></tr>`;
		html += `<tr><td colspan='2'><h2>#${episodeData.number}: ${episodeData.summary}</h2></td></tr>`
		html += '</table>';
	} else {
		html = `There is new episode for ${seriesId}: ${episodeData}, but could not get series details???`;
	}

	return html;
}

async function doIt()  {
  const showIds = await fs.readFile('show-ids.txt', 'utf-8');
	// const showIds = "50415,"

	const limiter = new Bottleneck({
    maxConcurrent: 1,
		minTime: 333
  });

  let html = '';
	const today = moment();
  const yesterday = today.subtract(1, 'days');
	const dateFormat = 'YYYY-MM-DD';


	await Promise.all(showIds.split(',').map(async (seriesId) => {
		const result = await limiter.schedule(async () => {
			let airingToday = await getAiringToDay(seriesId, today.format(dateFormat));

			if(airingToday !== undefined) {
				
				return await formatEpisodeAsHtml(seriesId, airingToday);
			}

			airingToday = await getAiringToDay(seriesId, yesterday.format(dateFormat));

			if(airingToday !== undefined) {
				return await formatEpisodeAsHtml(seriesId, airingToday);
			}

			return '';

		});

		html += result; // + '\r\n';
	}));

	html = html.trim();
  if (html.length > 0) {
    // html = '<div>' + html + '</div>';
    console.log('Sending email with shows airing today')
		console.log({html});
	const TelegramBot = require('node-telegram-bot-api');
const token = '7532748222:AAGYV2bNx_uiOitnNp40enGeyKgbfmlFWA4';
const bot = new TelegramBot(token, {polling: false});

await bot.sendMessage('6884382841', html + '\r\n');
// await emailResult(html);
		// console.log(html);
  } else {
    console.log('No shows airing today')
  }
}

// const formatShowAsHtml = (details, show) => {
//   let html = `<table><tr><td><h1>${details.seriesName}</h1><img src="${details.banner}" /></td></tr>`

//   const filename = show.filename;

//   if (filename.length > 0) {
//     html += `<tr><td width="50%"><h2># ${show.airedEpisodeNumber}: ${show.episodeName}</h2></td><td width="50%"><img width="100%" src="${filename}" /></td></tr>`
//   } else {
//     html += `<tr><td colspan="2"><h2># ${show.airedEpisodeNumber}: ${show.episodeName}</h2></td></tr>`
//   }

//   html += `<tr><td>${show.overview}</td></tr>`

//   html += '</table>'

//   return html;
// }

const emailResult = async (body) => {
  const data = {
    from: 'node-show-reminder <mig@jesperhalvorsen.dk>',
    to: process.env.SEND_TO,
    subject: 'TV Shows to watch today 😊',
    html: body,
  };

  const result = await mailgun.messages().send(data);
  console.log(result);
}

process.stdout.write('\033c');

doIt().then(() => {
  console.log('All done');

  // process.stdin.setRawMode(true);
  // process.stdin.resume();
  // process.stdin.on('data', process.exit.bind(process, 0));
});
