const express = require('express');
const app = express();

const PORT = 8080;

const makeCodeAndMessage = (code, message) => {
    return {
        code: code,
        message: message
    };
}
app.get('/user', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /user GET'));
});

app.post('/user', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /user POST'));
});

app.get('/song', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /song GET'));
});

app.post('/song', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /song POST'));
});

app.post('/songaction', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /songaction'));
});

app.get('/playlist', (req, res) => {
    res.json(makeCodeAndMessage(200, 'OK /playlist'));
});

app.listen(port=PORT, () => console.log("Server running on port", PORT));
