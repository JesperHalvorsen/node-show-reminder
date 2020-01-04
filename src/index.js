require('dotenv').config();
const axios = require('axios').default;
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');
const moment = require('moment');

var mailgun = require('mailgun-js')({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});

const tvDbApiKey = process.env.TVDB_API_KEY;
const tvDbUserKey = process.env.TVDB_USERKEY;
const tokenFilename = path.join(__dirname, '..', 'token.txt');

const tvDbBaseUrl = 'https://api.thetvdb.com';

// console.log({tvDbApiKey, tvDbUserKey});

const getJSONToken = async () => {
  let token = await loadTokenFromFile();

  if (token) {
    return token;
  }

  console.log('not cached token - or it is expired...');
  const response = await axios({
    method: 'POST',
    url: `${tvDbBaseUrl}/login`,
    data: {
      apikey: tvDbApiKey,
      userkey: tvDbUserKey,
    }
  });

  token = response.data.token;

  await fs.writeFile(tokenFilename, token);

  return token;
}

const loadTokenFromFile = async () => {
  console.log('loadTokenFromFile')
  if (fs.existsSync(tokenFilename)) {
    const token = await fs.readFile(tokenFilename, 'utf-8');

    const decoded = jwt.decode(token);

    if (Date.now() >= decoded.exp * 1000) {
      return undefined;
    }

    return token;
  }

  return undefined;
}

const getAuthHeader = (token) => {
  return {'Authorization': "Bearer " + token};
}

/*
{
  data: {
    id: 270205,
    seriesId: '',
    seriesName: 'Below Deck',
    aliases: [],
    season: '7',
    poster: 'posters/270205-4.jpg',
    banner: 'graphical/270205-g3.jpg',
    fanart: 'fanart/original/270205-3.jpg',
    status: 'Continuing', | "Ended"
    firstAired: '2013-06-10',
    network: 'Bravo',
    networkId: '1316',
    runtime: '45',
    language: 'en',
    genre: [ 'Reality' ],
    overview: 'Cruise into uncharted waters with this docu-series that follows a group of crewmembers living and working aboard “Honor,” a 164’ mega-yacht. The upstairs and downstairs worlds collide when this young single crew, known as “yachties,” live, love and work together onboard the luxurious, privately owned yacht, while tending to the ever-changing needs of their wealthy, demanding clients. While each crew member brings a different level of experience, they all share a love for this lifestyle that enables them to travel to some of the most beautiful and exotic locales in the world. Each episode features different charter guests -- from millionaires, to entertainers to hard-partying well-heeled friends -- as they move onto the boat for an at sea adventure.',
    lastUpdated: 1577636101,
    airsDayOfWeek: 'Tuesday',
    airsTime: '9:00 PM',
    rating: 'TV-14',
    imdbId: 'tt2342499',
    zap2itId: 'EP01554332',
    added: '2013-05-26 07:34:51',
    addedBy: 16553,
    siteRating: 6.8,
    siteRatingCount: 139,
    slug: 'below-deck'
  }
}
*/

const getFullImageUrl = (url) => {
  return url.trim().length > 0 ? `https://artworks.thetvdb.com/banners/${url}` : '';
}

/*
{
  links: { first: 1, last: 1, next: null, prev: null },
  data: [
    {
      id: 7325436,
      airedSeason: 1,
      airedSeasonID: 822447,
      airedEpisodeNumber: 1,
      episodeName: 'Empty Best',
      firstAired: '2019-10-27',
      guestStars: [],
      directors: [Array],
      writers: [Array],
      overview: 'On the day before her son leaves for college, Eve Fletcher has to deal with some inappropriate behavior in the workplace. Brendan runs into an ex-girlfriend at a party.',
      language: [Object],
      productionCode: '',
      showUrl: '',
      lastUpdated: 1573338686,
      dvdDiscid: '',
      dvdSeason: 1,
      dvdEpisodeNumber: 1,
      dvdChapter: null,
      absoluteNumber: 1,
      filename: 'episodes/366195/7325436.jpg',
      seriesId: 366195,
      lastUpdatedBy: 1,
      airsAfterSeason: null,
      airsBeforeSeason: null,
      airsBeforeEpisode: null,
      imdbId: 'tt9028266',
      contentRating: null,
      thumbAuthor: null,
      thumbAdded: '',
      thumbWidth: '640',
      thumbHeight: '360',
      siteRating: 0,
      siteRatingCount: 0,
      isMovie: 0
    },
*/
const getSeriesDetail = async (token, seriesId) => {
  const response = await axios({
    method: 'GET',
    url: `${tvDbBaseUrl}/series/${seriesId}`,
    headers: getAuthHeader(token),
  });

  return patchSeason(response.data.data);
}

const getNewestSeason = async (token, seriesId) => {
  const response = await axios({
    method: 'GET',
    url: `${tvDbBaseUrl}/series/${seriesId}`,
    headers: getAuthHeader(token),
  });

  // console.log(response.data);

  return parseInt(response.data.data.season);
}

const getSerieEpisodes = async (token, seriesId, season) => {
  let episodes = [];

  let next = 1;

  while(next !== null) {
    const response = await getSerieEpisodesPage(token, seriesId, season, next);

    next = response.links.next;
    episodes = episodes.concat(response.data);
  }

  episodes.map(e => patchEpisode(e));

  return episodes;
}

const patchEpisode = (episode) => {
  episode.filename = getFullImageUrl(episode.filename);
  episode.firstAired = moment(episode.firstAired);
  episode.lastUpdated = parseUnixTimeStamp(episode.lastUpdated);

  return episode;
}

const patchSeason = (season) => {
  season.poster = getFullImageUrl(season.poster);
  season.banner = getFullImageUrl(season.banner);
  season.fanart = getFullImageUrl(season.fanart);
  season.lastUpdated = parseUnixTimeStamp(season.lastUpdated);

  return season;
}

const parseUnixTimeStamp = (timestamp) => {
  return new Date(timestamp * 1000);
}

const getSerieEpisodesPage = async (token, seriesId, season, page) => {
  // console.log('getting page #', page);
  // console.log('url', `${tvDbBaseUrl}/series/${seriesId}/episodes/query?airedSeason=${season}&page=${page}`)

  const response = await axios({
    method: 'GET',
    url: `${tvDbBaseUrl}/series/${seriesId}/episodes/query?airedSeason=${season}&page=${page}`,
    headers: getAuthHeader(token),
  });

  return response.data;
}

const episodeAiringToday = (episodes) => {
  let today = moment();
  let yesterday = today.subtract(1, 'days');
  
  return episodes.filter(e => e.firstAired.isSame(today, 'day') || e.firstAired.isSame(yesterday, 'day'));
}

async function doIt()  {
  const showIds = await fs.readFile('show-ids.txt', 'utf-8');

  const token = await getJSONToken();

  let html = '';

  await Promise.all(showIds.split(',').map(async (seriesId) => {
    try {
      const details = await getSeriesDetail(token, seriesId);
      // console.log(details);
    
      if(details.status !== 'Ended') {
        lastSeason = await getNewestSeason(token, seriesId);
        // console.log('season', lastSeason);

        const episodes = await getSerieEpisodes(token, seriesId, lastSeason);
        // console.log('# episodes: ', episodes.length)
      
        const airedToday = episodeAiringToday(episodes);
      
        if(airedToday && airedToday.length > 0) {
          console.log('Bingo', airedToday[0]);
      
          html += formatShowAsHtml(details, airedToday[0]);
        } else {
          // console.log('last episode', episodes[episodes.length -1]);
          // console.log('not today', episodes)
        }
      } else {
        // console.warn(`Bad status "${details.status}" for show with id ${seriesId}`);
      }
    } catch(e) {
      console.error(`Exception handling show with id "${seriesId}"`, e);
    }
  }));

  if (html.length > 0) {
    html = '<div>' + html + '</div>';
    console.log('Sending email with shows airing today')
    await emailResult(html);
  } else {
    console.log('No shows airing today')
  }
}

const formatShowAsHtml = (details, show) => {
  let html = `<table><tr><td><h1>${details.seriesName}</h1><img src="${details.banner}" /></td></tr>`
      
  const filename = show.filename;

  if (filename.length > 0) {
    html += `<tr><td width="50%"><h2># ${show.airedEpisodeNumber}: ${show.episodeName}</h2></td><td width="50%"><img width="100%" src="${filename}" /></td></tr>`
  } else {
    html += `<tr><td colspan="2"><h2># ${show.airedEpisodeNumber}: ${show.episodeName}</h2></td></tr>`
  }

  html += `<tr><td>${show.overview}</td></tr>`
  
  html += '</table>'

  return html;
}

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
