const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const db = require('./db');
const resolveCallback = require('./helpers').resolveCallback;
const spotify = require('./apis/spotify');
const R = require('ramda');

const config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf-8'));

const findInFoundSongs = (preferences, cb) => {
    const topPreferences = R.map(p => p.code,
        R.take(3, R.sort((p1, p2) => p2.score - p1.score, preferences)));
    const criteria = R.zipObj(topPreferences, [{'$gt': 0.3}, {'$gt': 0.3}, {'$gt': 0.3}]);
    console.log("CRITERIA", topPreferences, criteria);
    db.getClient().connect((err, client) => {
        const songColl = client.db(config.db.name).collection("songs");
        songColl.find({ $or: criteria }, (err, results) => {
            cb(err, results);
        });
    });
}

const makePlaylist = (userId, category, cb) => {
    db.getUser(userId, (err, result) => {
        const preferences = result.preferences;
        // has preferences, use this to determine characteristics
        const preference = R.filter(p => p[category] !== undefined, preferences)[0];
        console.log("PREF", preference);
        if (preference !== undefined || preference !== null) {
            const topPreferences = Object.keys(preference[category]).slice(0, 3);
            findInFoundSongs(topPreferences, (err, songsLogged) => {
                if (songsLogged.length > 20) {
                    cb(null, songsLogged);
                } else {
                    console.log(topPreferences);
                    const topSongs = R.take(5, R.sort((s1, s2) => s2.score - s1.score,
                        R.map(s => R.mean(R.map(p => s[p], topPreferences)), songsLogged)));
                    console.log(topSongs);
                    spotify.getTracksBasedOnCriteria(userId, R.map(s => s.trackId, topSongs), (err, songs) => {
                        spotify.getTrackFeatures(userId, R.map(s => s.trackId, results), (err, features) => {
                            R.forEach(i => songs[i]['features'] = features[i], R.range(0, features.length));
                            db.insertSongs(songs);
                            cb(null, songsLogged.concat(songs));
                        });
                    });
                }
            });
        } else { // has no preferences, load new set of songs
            spotify.getInitialTracks(userId, category, (err, tracks) => {
                spotify.getTrackFeatures(userId, R.map(s => s.trackId, tracks), (err, features) => {
                    features = features.audio_features;
                    R.forEach(i => tracks[i]['features'] = features[i], R.range(0, features.length));
                    cb(null, tracks);
                });
            });
        }
    });
}

exports.makePlaylist = makePlaylist;
