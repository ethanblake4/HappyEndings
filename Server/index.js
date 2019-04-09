const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const sio = require('socket.io')(http);
const rstr = require('randomstring');
const device = require('express-device');

app.use(bodyParser());
app.use(device.capture());
app.use(express.static('static'));

let decisionTree = {
    john: [
        {
            type: 'question',
            question: 'Do you like Mary?',
            prop: 'loveInterest',
            choices: [
                { name: 'Yes', value: 'mary', chance: 1 },
                { name: 'No', value: 'madge',  chance: 1 },
            ]
        },
        {
            type: 'question',
            question: 'What skill would you like to master?',
            prop: 'skill',
            choices: [
                { name: 'Piano playing', value: 0, chance: 1},
                { name: 'Whittling', value: 1, chance: 1},
                { name: 'Farming', value: 2, chance: 1}
            ]
        },
        {type: "oneof",
        options: [
            {
                type: 'question',
                question: 'What is your opinion on the youth of today?',
                prop: 'age',
                choices: [
                    { name: 'I am the youth of today', value: 26, chance: 1 },
                    { name: 'What\'s a Snap Chat?', value: 45, chance: 1 },
                    { name: 'I hate those youth of today!', value: 75, chance: 1 }
                ]
            },
            {
                type: 'question',
                question: 'What\'s your favorite sport?',
                choices: [
                    { name: 'Football', value: 26, chance: 1 },
                    { name: 'Tennis', value: 45, chance: 1 },
                    { name: 'Golf', value: 75, chance: 1 }
                ]
            }
        ]},
        {
            type: 'question',
            question: 'What is your opinion on guns in America?',
            prop: 'gun',
            choices: [
                { name: 'For law enforcement only', value: 0, chance: 1 },
                { name: 'Should be available with permits', value: 1, chance: 1 },
            ]
        },
        {
            type: 'oneof',
            options: [
                {
                    type: 'question',
                    question: 'You find someone’s wallet on the street. Do you:',
                    prop: 'goodness',
                    choices: [
                        { name: 'Return the wallet', value: 1, chance: 1 },
                        { name: 'Assume their identity and embark on a nationwide shopping spree', value: 0, chance: 1 },
                    ]
                },
                {
                    type: 'question',
                    question: 'What\'s your favorite animal?',
                    prop: 'goodness',
                    choices: [
                        { name: 'Bees', value: 0, chance: 1 },
                        { name: 'Rabbits', value: 1, chance: 1 },
                    ]
                }
            ]
        }
    ],
    mary: [
        {
            type: 'multi',
            question: 'I tend to see:',
            choices: [
                { name: 'The good in people', chance: 1, props: {trustingness: 1} },
                { name: 'The bad in people', chance: 1, props: {trustingness: 0} },
                { name: 'The emerging butterfly in people', chance: 1, props: {trustingness: 1, metaphor : 1} },
            ]
        },
        {
            type: 'question',
            question: 'The most adorable kitten ever arrives at your doorstep, ' +
                'with part of the phone number scratched off on its collar. Do you:',
            prop: 'attachment',
            choices: [
                { name: 'Keep it', value: 0, chance: 1 },
                { name: 'Attempt to locate its owner', value: 1, chance: 1 },
            ]
        },
        {
            type: 'question',
            question: 'Do you like John?',
            prop: 'love',
            choices: [
                { name: 'Yes', value: 0, chance: 1 },
                { name: 'No', value: 1, chance: 1 },
                { name: 'I don\'t even like men', value: 2, chance: 0.6 },
            ]
        },
        {
            type: 'oneof',
            options: [
                {
                    type: 'question',
                    question: 'Top on my bucket list:',
                    prop: 'risk',
                    choices: [
                        { name: 'Skydiving', value: 1, chance: 1 },
                        { name: 'Swimming with dolphins', value: 0, chance: 1 },
                    ]
                },
                {
                    type: 'question',
                    question: 'You win $400 at blackjack.',
                    prop: 'goodness',
                    choices: [
                        { name: 'Double or nothing', value: 1, chance: 1 },
                        { name: 'Quit while you\'re ahead', value: 0, chance: 1 },
                    ]
                }
            ]
        },
        {
            type: 'question',
            prop: 'hobby',
            question: 'What\'s something you\'d like to get good at?',
            choices: [
                { name: 'Metalworking', value: 'metalworking', chance: 1 },
                { name: 'Trumpet', value: 'trumpet', chance: 1 },
                { name: 'Birdwatching', value: 'birdwatching', chance: 1}
            ]
        }
    ]
};

let debugGyro = false;

let socketAssignees = {};
let _session = {};

app.get('/', function(req, res){
    if(req.device.type === 'phone') res.sendFile(__dirname + '/static/mobile.html');
    else res.sendFile(__dirname + '/static/game.html');
});
app.get('/m', function(req, res){
    res.sendFile(__dirname + '/static/mobile.html');
});

let session = "";
let didStart = {};
let responsesMary = [];
let responsesJohn = [];
let randomNumber = 0;
let characters = ["john", "mary"];

sio.on('connection', function(socket){

    console.log(`User ${socket.id} connected`);

    socket.on('disconnect', function(){
        console.log(`User ${socket.id} disconnected`);
        console.log(`LEAVE ${socket.id} (to: room ${socket.roomSecret})`);
        socket.to(socket.roomSecret).emit('leave', socket.nickname);
    });

    socket.on('host create session', function(_){
        let sess = rstr.generate({
            length: 4,
            charset: 'alphanumeric'
        });
        session = sess;
        didStart[session] = false;
        socket.emit('session created', sess);

        console.log(`Host ${socket.id} created room "${sess}"`);
        socket.nickname = "<<HOST>>";
        socket.join(sess);
    });

    socket.on('start', function() {
        console.log('start');
        sio.to(session).emit('start');
        didStart[session] = true;
    });

    socket.on('client connect to', function() {
        if(!didStart[session]) {
            socket.join(session);
            if(!_session.hasOwnProperty(session)) _session[session] = [socket];
            else _session[session].push(socket);
            socket.roomSecret = session;
            console.log('client ' + socket.id + ' connected to ' + session);
            socket.to(session).emit('join', '');
        }
    });

    socket.on('host assign characters', function() {
        console.log('HOST: Assign Characters');

        const cli_ = _session[session];
        if(!_session.hasOwnProperty(session)) return;
        let maxAssign = _session[session].length / characters.length;
        console.log(`MaxAssign: ${maxAssign}`);
        let cx = [];
        cli_.forEach((client) => {
            let r = false;
            while(!r) {
                const rnd = Math.random();
                let cind = Math.floor(rnd * characters.length);
                if (cx.hasOwnProperty(characters[cind])) {
                    if (cx[characters[cind]] < maxAssign) {
                        cx[characters[cind]]++;
                        socketAssignees[client.id] = characters[cind];
                        client.emit('select character', characters[cind]);
                        r = true;
                    }
                } else {
                    cx[characters[cind]] = 1;
                    socketAssignees[client.id] = characters[cind];
                    client.emit('select character', characters[cind]);
                    r = true;
                }
            }
        });
    });

    socket.on('host question', function() {
        let idxJohn = 0;
        let idxMary = 0;
        let hasr = false;
        shuffle(_session[session]).forEach((client) => {
            if(debugGyro) {
                client.emit('question', {
                    text: "Shake your phone to generate a random number!",
                    gyro: 1
                });
                return;
            }
            if(socketAssignees[client.id] === characters[0]) {
                idxJohn++;
                if(idxJohn > decisionTree.john.length) {
                    if(idxJohn === decisionTree.john.length + 1 && !hasr) {
                        client.emit('question', {
                            text: "Shake your phone to generate a random number!",
                            gyro: 1
                        });
                        hasr = true;
                    }
                    client.emit('noquestion');
                    return;
                }
            } else {
                idxMary++;
                if(idxMary > decisionTree.mary.length) {
                    if(idxMary === decisionTree.mary.length + 1 && !hasr) {
                        client.emit('question', {
                            text: "Shake your phone to generate a random number!",
                            gyro: 1
                        });
                        hasr = true;
                    }
                    client.emit('noquestion');
                    return;
                }
            }
            let node = decisionTree[socketAssignees[client.id]][socketAssignees[client.id] === characters[0] ? idxJohn - 1 : idxMary - 1];
            let res;
            if(node.type === 'question') {
                let choices = node.choices;
                let addedChoices = [];
                choices.forEach((choice) => {
                    if(choice.chance === 1) addedChoices.push({
                        name: choice.name,
                        props: [
                            {
                                prop: node.prop,
                                value: choice.value
                            }
                        ]
                    });
                });
                res = addedChoices;
            } else if (node.type === 'multi') {
                let choices = node.choices;
                let addedChoices = [];
                choices.forEach((choice) => {
                    if(choice.chance === 1) addedChoices.push({
                        name: choice.name,
                        props: Object.entries(choice.props).map((pr) => {
                            return {
                                prop: pr[0],
                                value: pr[1]
                            }
                        })
                    });
                });
                res = addedChoices;
            }
            client.emit('question', {
                text: node['question'],
                answers: res
            });
        });
    });

    socket.on('client choice', function(resp) {
        console.log("Client " + socket.id + " choice: ");
        console.log(resp);
        socket.to(session).emit('server got client response');
        resp['props'].forEach(p1 => {
            if(resp['person'] === 'mary') {
                responsesMary.push(p1);
            } else responsesJohn.push(p1);
        });
    });

    socket.on('client gyro', function(resp) {
        socket.to(session).emit('server got client response');
        randomNumber = resp['gyro'];
    });

    socket.on('make story', function() {
        socket.emit('here the story', [responsesMary, responsesJohn, randomNumber]);
    });
});

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

http.listen(80, function(){
    console.log('listening on *:80');
});