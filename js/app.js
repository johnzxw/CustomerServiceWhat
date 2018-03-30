var app = require('http').createServer(function (req, res) {
    // 添加响应头
    res.setHeader("Access-Control-Allow-Origin", "*");
});
var io = require('socket.io')(app);
var PORT = 8081;
/*定义用户数组*/
var users = [];

const mongoose = require("mongoose");
/* 连接本地mongodb */
mongoose.connect("mongodb://127.0.0.1:27017/chat", function (err) {
    if (!err) {
        console.log("connected to Mongodb");
    } else {
        throw err;
    }
});
const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var ChatlogSchema = new Schema({
    data: {type: String},
    sendUser: {type: String},
    receiveUser: {type: String},
    roomId: {type: String},
    receiveTime: {type: Number, index: true},
    date: {type: Date, default: Date.now}

});
var ChatUserLoginSchema = new Schema({
    name: {type: String},
    ip: {type: String},
    roomId: {type: String},
    loginTime: {type: Number, index: true},
    date: {type: Date, default: Date.now}

});
//新建model 设置表名称为chatlog
var ChatlogModel = mongoose.model("chatlog", ChatlogSchema, "chatlog");
var ChatUserLoginModel = mongoose.model("chatuserloginlog", ChatUserLoginSchema, "chatuserloginlog");
app.listen(PORT, {origins: '*:*'});
io.on('connection', function (socket) {
    /*是否是新用户标识*/
    var isNewPerson = true;
    /*当前登录用户*/
    var username = null;
    var roomId = null;
    /*监听登录*/
    socket.on('login', function (data) {
        for (var i = 0; i < users.length; i++) {
            if (users[i].username === data.username) {
                isNewPerson = false;
                break;
            } else {
                isNewPerson = true;
            }
        }
        isNewPerson = true;
        username = data.username;
        if (data.roomid) {
            roomId = data.roomid;
        } else {
            roomId = socket.id;
        }
        var returnData = {username: username, sockeid: socket.id, rooms: socket.rooms};
        if (isNewPerson) {
            users.push({
                username: data.username
            });
            /*登录成功*/
            if (roomId) {
                socket.join(roomId);
            }
            var ChatUserLogin = new ChatUserLoginModel();
            ChatUserLogin.name = data.username;
            ChatUserLogin.roomId = roomId;
            ChatUserLogin.ip = socket.handshake.address;
            ChatUserLogin.loginTime = new Date().getTime();
            ChatUserLogin.save(function (err) {
                if (err) {
                    console.log('save failed');
                }
                console.log("save success");
            });
            socket.emit('loginSuccess', returnData);
            /*向所有连接的客户端广播add事件*/
            io.sockets.to(roomId).emit('add', data);
        } else {
            /*登录失败*/
            socket.emit('loginFail', returnData);
        }
    });

    /*监听发送消息*/
    socket.on('sendMessage', function (data) {
        // socket.emit('receiveMessage', data);
        var LogInsert = new ChatlogModel();
        LogInsert.data = data.message;
        LogInsert.roomId = roomId;
        LogInsert.sendUser = data.username;
        LogInsert.receiveUser = "";
        LogInsert.receiveTime = new Date().getTime();
        LogInsert.save(function (err) {
            if (err) {
                console.log('save failed');
            }
            console.log("save success");
        });
        io.sockets.to(roomId).emit('receiveMessage', data);
    });

    /*退出登录*/
    socket.on('disconnect', function () {
        /*向所有连接的客户端广播leave事件*/
        io.sockets.to(roomId).emit('leave', username);
        users.map(function (val, index) {
            if (val.username === username) {
                users.splice(index, 1);
            }
        })
    })
})
console.log('app listen at' + PORT);
