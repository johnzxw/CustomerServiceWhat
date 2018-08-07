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
//发送消息记录
var ChatlogSchema = new Schema({
    data: {type: String},
    sendUser: {type: String},
    receiveUser: {type: String},
    ip: {type: String},
    roomId: {type: String},
    receiveTime: {type: Number, index: true, default: new Date().getTime()},
    date: {type: Date, default: Date.now}

});
//用户登录记录
var ChatUserLoginSchema = new Schema({
    name: {type: String},
    ip: {type: String},
    roomId: {type: String},
    loginTime: {type: Number, index: true, default: new Date().getTime()},
    date: {type: Date, default: Date.now}

});
//用户退出记录
var ChatUserLogoutSchema = new Schema({
    name: {type: String},
    ip: {type: String},
    roomId: {type: String},
    loginTime: {type: Number, index: true, default: new Date().getTime()},
    date: {type: Date, default: Date.now}
});
//房间里面用户
var ChatRoomUserSchema = new Schema({
    name: {type: String},
    roomId: {type: String, index: true},
    joinTime: {type: Number, index: true, default: new Date().getTime()},
    ip: {type: String},
    isGroupMain: {type: Boolean, default: false},
    date: {type: Date, default: Date.now}
});
//新建model 设置表名称为chatlog
var ChatlogModel = mongoose.model("chatlog", ChatlogSchema, "chatlog");
var ChatUserLoginModel = mongoose.model("chatuserloginlog", ChatUserLoginSchema, "chatuserloginlog");
var CharUserLogoutModel = mongoose.model("chatuserlogoutlog", ChatUserLogoutSchema, "chatuserlogoutlog");
var ChatRoomUserModel = mongoose.model("chatroomuser", ChatRoomUserSchema, "chatroomuser");
// app.listen(PORT, {origins: '*:*'});
app.listen({
    host: 'localhost',
    port: PORT,
    exclusive: true,
    origins: '*:*'
});
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
            isgroupmain = false;
            roomId = data.roomid;
        } else {
            isgroupmain = true;
            roomId = socket.id;
        }
        var returnData = {username: username, sockeid: socket.id, rooms: socket.rooms};
        if (isNewPerson) {
            users.push({
                username: data.username
            });
            /*登录成功*/
            if (roomId) {
                var chatRoomUser = new ChatRoomUserModel();
                chatRoomUser.name = username;
                chatRoomUser.roomId = roomId;
                chatRoomUser.ip = getClientIp();
                chatRoomUser.isGroupMain = isgroupmain;
                chatRoomUser.save(function (err) {
                    if (err) {
                        console.log("join room fail! data:" + chatRoomUser.toLocaleString());
                    }
                });
                //判断当前房间号 是否存在
                if( typeof(io.sockets.adapter.rooms[roomId])  == 'undefined' ){
                    console.log(roomId+'房间不存在');
                }
                //查看当前roomid的房间信息
                console.log(io.sockets.adapter.rooms[roomId]);
                //所有的房间信息
                console.log(socket.adapter.rooms);
                socket.join(roomId);
            }
            var ChatUserLogin = new ChatUserLoginModel();
            ChatUserLogin.name = data.username;
            ChatUserLogin.roomId = roomId;
            ChatUserLogin.ip = getClientIp();
            ChatUserLogin.loginTime = new Date().getTime();
            ChatUserLogin.save(function (err) {
                if (err) {
                    console.log('save login log failed! data:' + ChatUserLogin.toLocaleString());
                }
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
        LogInsert.ip = getClientIp();
        LogInsert.receiveTime = new Date().getTime();
        LogInsert.save(function (err) {
            if (err) {
                console.log('save send message failed! data:' + LogInsert.toLocaleString());
            }
        });
        io.sockets.to(roomId).emit('receiveMessage', data);
    });

    /*退出登录*/
    socket.on('disconnect', function () {
        var chatuserlogout = new CharUserLogoutModel();
        chatuserlogout.name = username;
        chatuserlogout.roomId = roomId;
        chatuserlogout.ip = getClientIp();
        chatuserlogout.save(function (err) {
            if (err) {
                console.log("save disconnect log fail ! data:" + chatuserlogout.toLocaleString());
            }
        });
        /*向所有连接的客户端广播leave事件*/
        io.sockets.to(roomId).emit('leave', username);
        users.map(function (val, index) {
            if (val.username === username) {
                users.splice(index, 1);
            }
        })
    });

    function getClientIp() {
        //nginx负载 upstream
        var ip = socket.handshake.headers["x-real-ip"];
        if (ip) {
            return ip;
        }
        var ip = socket.request.connection.remoteAddress;
        if (ip) {
            return ip;
        }
        return socket.handshake.address;
    }
});
console.log('app listen at' + PORT);
