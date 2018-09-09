const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');

const config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf-8'))['apis']['darksky'];
exports.getCurrentWeather = (lat, lng) =>
    axios.get(`https://api.darksky.net/forecast/${config['secret']}/${lat},${lng}`)

