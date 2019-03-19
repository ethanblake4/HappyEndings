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
            question: 'Who do you like?',
            prop: 'love_interest',
            choices: [
                { name: 'Mary', value: 'mary', chance: 1 },
                { name: 'Madge', value: 'madge',  chance: 1 },
                { name: 'Fred', value: 'fred', chance: 0.1 }
            ]
        },
        {
            type: 'question',
            question: 'What is your opinion on the youth of today?',
            prop: 'age',
            choices: [
                { name: 'They cool', value: 26, chance: 1 },
                { name: 'What\'s a Snap Chat?', value: 45, chance: 1 },
                { name: 'I hate those youth of today!', value: 75, chance: 1 }
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
                        { name: 'Pipa Pipa', value: 0.5, chance: 1 },
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
        }
    ]
};

app.get('/', function(req, res){
    if(req.device.type === 'phone') res.sendFile(__dirname + '/static/mobile.html');
    else res.sendFile(__dirname + '/static/game.html');
});

let session = "";

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
        socket.emit('session created', sess);

        console.log(`Host ${socket.id} created room "${sess}"`);
        socket.nickname = "<<HOST>>";
        socket.join(sess);
    });

    socket.on('start', function() {
        console.log('start');
        sio.to(session).emit('start');
    });

    socket.on('client connect to', function() {
        socket.join(session);
        socket.roomSecret = session;
        console.log('client ' + socket.id + ' connected to ' + session);
        socket.to(session).emit('join', '');
        socket.emit('people', clientsOfRoom(session).map((s) => userProps(s)));
    });

});

function clientsOfRoom(roomId) {
    let res = [], room = sio.sockets.adapter.rooms[roomId];
    if (room) {
        for (let id of Object.keys(room.sockets)) {
            if(sio.sockets.adapter.nsp.connected[id] != null) {
                res.push({'id': id, 'socket': sio.sockets.adapter.nsp.connected[id]});
            }
        }
    }
    return res;
}

function userProps(cl) {
    return {'id': cl.id, 'nickname': cl.socket.nickname}
}

http.listen(80, function(){
    console.log('listening on *:80');
});