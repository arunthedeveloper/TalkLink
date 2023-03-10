// Import required modules
const express = require("express");
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const io = require("socket.io");

// Create Express app
const app = express();

// Start the server and listen on port 3000
const server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port 3000");
});

// Configure socket.io to use the server
const socketIo = io(server, {
  allowEIO3: true, // enable compatibility with Socket.IO v2.x clients
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, "")));

// Initialize an array to store user connections
const userConnections = [];

// Handle socket.io connections
socketIo.on("connection", (socket) => {
  console.log("socket id is ", socket.id);

  // Handle userconnect event
  socket.on("userconnect", (data) => {
    console.log("userconnent", data.displayName, data.meetingid);

    // Find other users in the same meeting
    const other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );

    // Add user to the userConnections array
    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });

    // Inform other users in the same meeting about the new user
    const userCount = userConnections.length;
    console.log(userCount);
    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_others_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userCount,
      });
    });

    // Inform the new user about other users in the same meeting
    socket.emit("inform_me_about_other_user", other_users);
  });

  // Handle SDPProcess event
  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connid).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });

  // Handle sendMessage event
  socket.on("sendMessage", (msg) => {
    console.log(msg);
    const mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      const meetingid = mUser.meeting_id;
      const from = mUser.user_id;
      const list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg,
        });
      });
    }
  });

  // Handle fileTransferToOther event
  socket.on("fileTransferToOther", (msg) => {
    console.log(msg);
    const mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      const meetingid = mUser.meeting_id;
      const from = mUser.user_id;
      const list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showFileMessage", {
          username: msg.username,
          meetingid: msg.meetingid,
          filePath: msg.filePath,
          fileName: msg.fileName,
        });
      });
    }
  });

  // Handle disconnect event
 
  socket.on("disconnect", function () {
    console.log("Disconnected");
    var disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      var meetingid = disUser.meeting_id;
      userConnections = userConnections.filter(
        (p) => p.connectionId != socket.id
      );
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        var userNumberAfUserLeave = userConnections.length;
        socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
          connId: socket.id,
          uNumber: userNumberAfUserLeave,
        });
      });
    }
  });

  // <!-- .....................HandRaise .................-->
  socket.on("sendHandRaise", function (data) {
    var senderID = userConnections.find((p) => p.connectionId == socket.id);
    console.log("senderID :", senderID.meeting_id);
    if (senderID.meeting_id) {
      var meetingid = senderID.meeting_id;
      // userConnections = userConnections.filter(
      //   (p) => p.connectionId != socket.id
      // );
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        var userNumberAfUserLeave = userConnections.length;
        socket.to(v.connectionId).emit("HandRaise_info_for_others", {
          connId: socket.id,
          handRaise: data,
        });
      });
    }
  });
  // <!-- .....................HandRaise .................-->
});

app.use(fileUpload());
app.post("/attachimg", function (req, res) {
  var data = req.body;
  var imageFile = req.files.zipfile;
  console.log(imageFile);
  var dir = "public/attachment/" + data.meeting_id + "/";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  imageFile.mv(
    "public/attachment/" + data.meeting_id + "/" + imageFile.name,
    function (error) {
      if (error) {
        console.log("couldn't upload the image file , error: ", error);
      } else {
        console.log("Image file successfully uploaded");
      }
    }
  );
});
