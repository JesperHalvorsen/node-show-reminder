[![Github Actions Show Reminder](https://github.com/JesperHalvorsen/node-show-reminder/actions/workflows/action.yaml/badge.svg)](https://github.com/JesperHalvorsen/node-show-reminder/actions/workflows/action.yaml)

# Links

Search for show: http://api.tvmaze.com/search/shows?
q=mare of easttown
# TO DO

[x] Move list of shows from secret to text file, so it is easier to update it

[ ] Notifications through Telegram?

[ ] Something needs to change, to keep the workflow running 😊

## TV Maze

https://www.tvmaze.com/api

API calls are rate limited to allow at least 20 calls every 10 seconds per IP address. If you exceed this rate, you might receive an HTTP 429 error. We say at least, because rate limiting takes place on the backend but not on the edge cache. So if your client is only requesting common/popular endpoints like shows or episodes (as opposed to more unique endpoints like searches or embedding), you're likely to never hit the limit. For an optimal throughput, simply let your client back off for a few seconds when it receives a 429.

