const express = require('express');
const bodyParser = require('body-parser');
const init = require('./init');
const db = require('./db');
const app = express();
const R = require('ramda');
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const qs = require('qs');
const darksky = require('./apis/darksky');
const playlist = require('./playlist');

const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf-8'));

app.use(bodyParser.json());

const PORT = 8080;

const sendCodeAndMessage = (code, message, res) => {
    res.status(code);
    res.json({
        code: code,
        message: message
    });
}

app.get('/user/:id', (req, res) => {
    db.getUser(req.params.id, (err, result) => {
        if (err !== null) {
            sendCodeAndMessage(400, "Invalid user id");
        } else {
            res.json(result);
        }
    });
});

app.post('/user', (req, res) => {
    db.insertUser(req.body, (err, result) => {
        if (err !== null) {
            sendCodeAndMessage(400, "User already exists", res);
        } else {
            sendCodeAndMessage(200, result, res);
        }
    });
});

app.put('/user/:id', (req, res) => {
    db.updateUser(req.params.id, req.body, (err, result) => {
        if (err !== null) {
            res.sendStatus(400);
        } else {
            if (result.result.nModified === 0) { res.sendStatus(304); }
            else { res.sendStatus(202); }
        }
    });
});

app.post('/song/:id', (req, res) => {
    db.getSong(req.params.id, (err, result) => {
        if (err !== null) {
            sendCodeAndMessage(400, 'Invalid song id');
        } else {
            sendCodeAndMessage(200, result);
        }
    });
});

app.post('/action/:song/:action', (req, res) => {
    db.updateUserAction(R.zipObj(['user', 'song', 'action'],
        [req.get('user'), req.params.song, req.params.action]), (err, result) => {
            res.sendStatus(result);
        });
});

app.get('/authorize_spotify', (req, res) => {
    const spotifyConfig = config.apis.spotify;
    const scopes = ['user-read-playback-state', 'user-read-currently-playing', 'playlist-read-collaborative',
        'playlist-read-private', 'playlist-modify-private', 'playlist-modify-public'];
    res.redirect(`https://accounts.spotify.com/authorize?client_id=${spotifyConfig.clientId}&response_type=code&redirect_uri=${spotifyConfig.redirect_uri}&state=${config.test.user._id}&scope=` + encodeURIComponent(scopes));
});

app.get('/playlist', (req, res) => {
    const lat = config.test.user.location.lat;
    const lng = config.test.user.location.lng;
    darksky.getCurrentWeather(lat,lng).then(category => {
        playlist.makePlaylist('', category.data.currently.icon, (err, result) => {
            db.insertSongs(result, (err, r) => {
                const features = R.map(feature =>
                    R.pick(['danceability', 'energy', 'loudness', 'speechiness',
                        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'],
                            feature), R.map(s => s.features, result));
                let totalFeatures = {};
                for (let key of Object.keys(features[0])) {
                    totalFeatures[key] = 0;
                }
                for (let feature of features) {
                    for (let key of Object.keys(feature)) {
                        totalFeatures[key] += feature[key];
                    }
                }
                let properties = {};
                for (let key of Object.keys(totalFeatures)) {
                    properties[key] = totalFeatures[key] / features.length;
                }
                let c = category.data.currently.icon;
                db.updatePreferences(config.test.user._id, R.zipObj([c], [properties]), (err, _) => {
                    sendCodeAndMessage(200, result, res);
                });
            });
        });
    });
});

app.get('/spotify_authorized', (req, res) => {
    const code = req.query.code;
    const userId = req.query.state;
    const spotifyConfig = config.apis.spotify;
    const options = {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        data: qs.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: spotifyConfig.redirect_uri,
            client_id: spotifyConfig.clientId,
            client_secret: spotifyConfig.clientSecret,
        }),
        url: 'https://accounts.spotify.com/api/token'
    };
    axios(options).then((resp) => {
        const creds = resp.data;
        creds['dateCreated'] = Date.now;
        db.storeCreds(userId, creds, (err, result) => {
            res.send('Spotify Authorization Success!');
        });
    });
});

app.get('/locations', (req, res) => {
    db.getLocations(req.query.codes !== undefined ? req.query.codes.split(",") : [], (err, result) => {
        if (err !== null) {
            sendCodeAndMessage(400, "Invalid location code", res);
        } else {
            sendCodeAndMessage(200, result, res);
        }
    });
});

app.get('/categories', (req, res) => {
    db.getCategories(req.query.codes !== undefined ? req.query.codes.split(",") : [], (err, result) => {
        if (err !== null) {
            sendCodeAndMessage(400, 'Invalid category code', res);
        } else {
            sendCodeAndMessage(200, result, res);
        }
    });
});

init.createAllIndexes(() =>
    init.buildSongMetadata(() =>
        app.listen(port=PORT, () => console.log("Server running on port", PORT))));
 

