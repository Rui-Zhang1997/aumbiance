const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const db = require('../db');
const R = require('ramda');
const resolveCallback = require('../helpers').resolveCallback;

const config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf-8'));
const configSpotify = config['apis']['spotify'];

const refreshToken = (userId, cb) => {
    userId = config.test.user._id;
    cb = resolveCallback(cb);
    db.getCreds(userId, (err, result) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const options = {
            method: 'POST',
            data: qs.stringify({
                grant_type: 'refresh_token',
                refresh_token: result.refresh_token
            }),
            headers: { 'Authorization': `Basic ${btoa(`${configSpotify.client_id}:${configSpotify.client_secret}`)}` },
            url: 'https://accounts.spotify.com/api/token'
        };
        axios(options).then((resp) => {
            db.storeCreds(userId, resp.data, cb);
        });
    });
}

const getKeyData = (track) => {
    const trackData = track.track;
    const artist = trackData.artists.length > 0 ? R.pick(['id', 'name'], trackData.artists[0]) : {};
    const title = trackData.name;
    const trackId = trackData.id;
    return {
        artist: artist,
        title: title,
        trackId: trackId
    }
}

exports.getInitialTracks = (userId, category, cb) => {
    cb = resolveCallback(cb);
    userId = config.test.user._id;
    db.getCreds(userId, (err, result) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const accessToken = result.access_token;
        const options = {
            method: 'GET',
            url: 'https://api.spotify.com/v1/search',
            params: {
                type: 'playlist',
                q: category,
                limit: 5
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        axios(options).then((resp) => {
            const playlists = resp.data.playlists.items;
            const playlistIds = R.map(p => p.id, playlists);
            Promise.all(R.map(pid =>
            axios.get(`https://api.spotify.com/v1/playlists/${pid}/tracks`, {headers: {
                Authorization: `Bearer ${accessToken}`
            } }), playlistIds)).then(resps => {
                const items = R.map(getKeyData,
                    R.flatten(R.map(t => t.items, R.map(r => r.data, resps))).slice(0, 50));
                cb(null, items);
            }); //.catch(err => console.log("ERROR", err));
        });
    });
}

exports.getTracksBasedOnCriteria = (userId, trackIds, cb) => {
    userId = config.test.user._id;
    cb = resolveCallback(cb);
    db.getCreds(userId, (err, result) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const accessToken = result.accessToken;
        const options = {
            method: 'GET',
            url: 'https://api.spotify.com/v1/recommendations',
            params: {
                limit: 25,
                seed_tracks: trackIds.join(',')
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        axios(options).then((resp) => {
            cb(null, R.map(getKeyData, resp.data));
        });
    });
}

exports.getTrackFeatures = (userId, tracks, cb) => {
    userId = config.test.user._id;
    cb = resolveCallback(cb);
    db.getCreds(userId, (err, result) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const accessToken = result.access_token;
        const options = {
            method: 'GET',
            url: 'https://api.spotify.com/v1/audio-features',
            params: {
                ids: tracks.join(',')
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        axios(options).then((resp) => {
            cb(null, resp.data);
        }); //.catch(err => console.log(JSON.stringify(err)));
    });
}
