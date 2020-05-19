/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */
import PushNotificationIOS from 'react-native';
import PushNotification from 'react-native-push-notification';
import PubNubReact from "pubnub-react";
import React, { Component } from "react";
import { StyleSheet, Image, Button, FlatList,Dimensions, Alert, PermissionsAndroid, Text, View,Platform } from "react-native";
import { GiftedChat, Bubble } from "react-native-gifted-chat";
import AsyncStorage from "@react-native-community/async-storage";
import _ from "lodash";
import { AudioRecorder, AudioUtils } from "react-native-audio";
import Ionicons from "react-native-vector-icons/Ionicons";
import Sound from "react-native-sound";
import config from "./config";
import ImagePicker from 'react-native-image-picker';
const RoomName = "newRoom";
export default class MainChat extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // isTyping: false,
      messages: [],
      onlineUsers: [],
      onlineUsersCount: 0,
      startAudio: false,
      hasPermission: false,
      audioPath: `${
          AudioUtils.DocumentDirectoryPath
          }/${this.messageIdGenerator()}test.aac`,
      playAudio: false,
      audioSettings: {
        SampleRate: 22050,
        Channels: 1,
        AudioQuality: "Low",
        AudioEncoding: "aac",
        MeteringEnabled: true,
        IncludeBase64: true,
        AudioEncodingBitRate: 32000
    }
    };
    this.pubnub = new PubNubReact({
      publishKey: config.pubnub_publishKey,
      subscribeKey: config.pubnub_subscribeKey,
      uuid: this.props.navigation.getParam("username"),
      // logVerbosity: true
      presenceTimeout: 60
    });
    this.pubnub.init(this);
  }
  getData = async () => {
    try {
      const value = await AsyncStorage.getItem("@loggedInUser");
      if (value !== null) {
        return value;
      }
    } catch (e) {
      console.log(e);
    }
  };

  static navigationOptions = ({ navigation }) => {
    return {
      headerTitle:
        navigation.getParam("onlineUsersCount", "No") + " member online",
      headerLeft: null,
      headerRight: (
        <Button
          onPress={() => {
            navigation.state.params.leaveChat();
          }}
          title="Logout"
          color="red"
        />
      )
    };
  };
  componentDidMount() {
    console.log("Didmount")
    PushNotification.configure({

      onRegister: function(token){
        console.log("tokennnnn",token);
      },

      onNotification : function(notification){
        console.log("Notificationnn",notification);
      
        notification.finish(PushNotificationIOS.FetchResult.notification)
      },

      popInitialNotification: true,

      requestPermissions:true,

    })


    this.pubnub.history(
      { channel: RoomName, reverse: true, count: 50 },
      (status, res) => {
        // console.log("res>", res);
        let newmessage = [];
        res.messages.forEach(function (element, index) {
          newmessage[index] = element.entry[0];
        });
        this.setState(previousState => ({
          messages: GiftedChat.append(previousState.messages, newmessage)
        }));
      }
    );
    this.PresenceStatus();
    this.checkPermission().then(async hasPermission => {
      this.setState({ hasPermission });
      if (!hasPermission) return;
      await AudioRecorder.prepareRecordingAtPath(
          this.state.audioPath,
          this.state.audioSettings
      );
      AudioRecorder.onProgress = data => {
          // console.log(data, "onProgress data");
      };
      AudioRecorder.onFinished = data => {
          // console.log(data, "on finish");
      };
  });
  }

  checkPermission() {
    if (Platform.OS !== "android") {
        return Promise.resolve(true);
    }
    const rationale = {
        title: "Microphone Permission",
        message:
            "AudioExample needs access to your microphone so you can record audio."
    };
    return PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        rationale
    ).then(result => {
        // console.log("Permission result:", result);
        return result === true || result === PermissionsAndroid.RESULTS.GRANTED;
    });
}

  componentWillMount() {
    console.log("Willmount")
    // this.Typing();
    this.props.navigation.setParams({
      onlineUsersCount: this.state.onlineUsersCount,
      leaveChat: this.leaveChat.bind(this)
    });

    this.pubnub.subscribe({
      channels: [RoomName],
      withPresence: true
    });
    this.pubnub.getMessage(RoomName, m => {
      this.setState(previousState => ({
        messages: GiftedChat.append(previousState.messages, m["message"])
      }));
    });

  }
  onSend(messages = []) {
console.log("messages",messages)
    this.pubnub.publish({
      message: messages,
      channel: RoomName
    });
  }

  PresenceStatus = () => {
    console.log("presnce status")
    this.pubnub.getPresence(RoomName, presence => {
      if (presence.action === "join") {
        console.log("users onilne", this.state.onlineUsers)
        let users = this.state.onlineUsers;

        users.push({
          state: presence.state,
          uuid: presence.uuid,
          mydata: "abc"
        });
        console.log("join room");
        this.setState({
          onlineUsers: users,
          onlineUsersCount: this.state.onlineUsersCount + 1
        });

        this.props.navigation.setParams({
          onlineUsersCount: this.state.onlineUsersCount
        });
      }

      if (presence.action === "leave" || presence.action === "timeout") {
        console.log("leave or timreout")
        let leftUsers = this.state.onlineUsers.filter(
          users => users.uuid !== presence.uuid
        );

        this.setState({
          onlineUsers: leftUsers
        });
        console.log("leave room");
        const length = this.state.onlineUsers.length;
        this.setState({
          onlineUsersCount: length
        });
        this.props.navigation.setParams({
          onlineUsersCount: this.state.onlineUsersCount
        });
      }

      if (presence.action === "interval") {
        console.log("interval");
        if (presence.join || presence.leave || presence.timeout) {
          let onlineUsers = this.state.onlineUsers;
          let onlineUsersCount = this.state.onlineUsersCount;

          if (presence.join) {
            console.log("join room at state");
            presence.join.map(
              user =>
                user !== this.uuid &&
                onlineUsers.push({
                  state: presence.state,
                  uuid: user
                })
            );
            console.log("presence.join.length>>>>>>>", presence.join.length)
            onlineUsersCount += presence.join.length;
          }

          if (presence.leave) {
            presence.leave.map(leftUser =>
              onlineUsers.splice(onlineUsers.indexOf(leftUser), 1)
            );
            onlineUsersCount -= presence.leave.length;
            console.log("leave room at state");
          }

          if (presence.timeout) {
            presence.timeout.map(timeoutUser =>
              onlineUsers.splice(onlineUsers.indexOf(timeoutUser), 1)
            );
            onlineUsersCount -= presence.timeout.length;
          }

          this.setState({
            onlineUsers,
            onlineUsersCount
          });
          this.props.navigation.setParams({
            onlineUsersCount: this.state.onlineUsersCount
          });
        }
      }
    });
  };

  leaveChat = () => {
    this.pubnub.unsubscribe({ channels: [RoomName] });
    return this.props.navigation.navigate("Login");
  };
  componentWillUnmount() {
    this.leaveChat();
  }

  renderBubble = props => {
    return (
        <View>
            {this.renderAudio(props)}
            <Bubble {...props} />
        </View>
    );
};
handleAvatarPress = props => {
  // add navigation to user's profile
};

renderAudio = props => {
  console.log("playadiooooooooooooooo",props.currentMessage._id)
  return !props.currentMessage.audio ? (
      <View />
  ) : (
          <Ionicons
          key={props.currentMessage._id}
              name="ios-play"
              size={35}
              color={this.state.playAudio ? "red" : "blue"}
              style={{
                  left: 90,
                  position: "relative",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  backgroundColor: "transparent"
              }}
               onPress={() => {
                // console.log("playaudio 1st",this.state.playAudio)
               if(!this.state.playAudio){
                  this.setState({
                      playAudio: true, messages:[...this.state.messages]
                  },()=>{
                    this.sound = new Sound(props.currentMessage.audio, "", error => {
                      if (error) {
                          console.log("failed to load the sound", error);
                      }
                     
                      this.sound.play(success => {
                        this.setState({ playAudio: false ,  messages:[...this.state.messages]});
                          // console.log(success, "success play");
                          if (!success) {
                              Alert.alert("There was an error playing this audio");
                          }
                          
                      });
                  });
                  });
                }
                else{
                  this.sound.stop();
                  this.setState({ playAudio: false , messages:[...this.state.messages]});
                }
              }}
          />
      );
};

  messageIdGenerator=()=>{
    // generates uuid.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        let r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

  handleAddPicture = () => {
    const { user } = this.props; // wherever you user data is stored;
    const options = {
      title: "Select Profile Pic",
      mediaType: "photo",
      takePhotoButtonTitle: "Take a Photo",
      maxWidth: 256,
      maxHeight: 256,
      allowsEditing: true,
      noData: true
    };
    ImagePicker.launchImageLibrary(options, response => {
      console.log("Response = ", response);
      // this.setState({image:response.path})
      const { uri } = response;
      const extensionIndex = uri.lastIndexOf(".");
      const extension = uri.slice(extensionIndex + 1);
      const allowedExtensions = ["jpg", "jpeg", "png"];
      const correspondingMime = ["image/jpeg", "image/jpeg", "image/png"];
      const file = {
        uri,
        name: `${this.messageIdGenerator()}.${extension}`,
        type: correspondingMime[allowedExtensions.indexOf(extension)]
      };
      this.setState({image:file})
      let username = this.props.navigation.getParam("username");
      const message = {};
      message._id = this.messageIdGenerator();
      message.createdAt = Date.now();
      message.user = {
          _id: username,
          name:username,
          avatar: "https://robohash.org/" + username
      };
      message.messageType = "image";
      message.image = uri;
      // console.log("message",message)
      // this.setState({messages: [...this.state.messages,message]},()=>{
      //   console.log("messagesss",this.state.messages)
      // })
        this.pubnub.publish({
          message:[message],
          channel:RoomName
        })

    });
  };
  handleAudio = async () => {
    if (!this.state.startAudio) {
        this.setState({
            startAudio: true
        });
        await AudioRecorder.startRecording();
    } else {
        this.setState({ startAudio: false });
        await AudioRecorder.stopRecording();
        const { audioPath } = this.state;
        let username = this.props.navigation.getParam("username");
     
        const fileName = `${this.messageIdGenerator()}.aac`;
        const file = {
            uri: audioPath ,
            name: fileName,
            type: `audio/aac`
        };
            const message = {};
                message._id = this.messageIdGenerator();
                message.createdAt = Date.now();
                message.user = {
                    _id: username,
                    name: username,
                    avatar:  "https://robohash.org/" + username
                };
                message.audio = audioPath;
                message.messageType = "audio";
                this.pubnub.publish({
                  message:[message],
                  channel:RoomName
                })

        
    }
};



  render() {
    console.log("render")
    let username = this.props.navigation.getParam("username");
    return (
      <View style={{ flex: 1 }}>
        <Button onPress={this.handleAddPicture} title="Add Picture" color="red" />
        <Ionicons
                name="ios-mic"
                size={35}
                color={this.state.startAudio ? "red" : "black"}
                style={{
                  marginLeft:20,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  zIndex: 2,
                  backgroundColor: "transparent"
              }}
              onPress={this.handleAudio}
                />
       
        <View style={styles.online_user_wrapper}>
          {this.state.onlineUsers.map((item, index) => {
            return (
              <View key={item.uuid} style={styles.avatar_wrapper}>
                {console.log("itemssss", this.state.image)}
                <Image
                  key={item.uuid}
                  style={styles.online_user_avatar}
                  source={{
                    uri: "https://robohash.org/" + item.uuid
                  }}
                />
                <Text style={{ fontSize: 20, color: "red" }}>{item.uuid}</Text>
              </View>
            );
          })}
        </View>
        <GiftedChat
          messages={this.state.messages}
          onSend={messages => {
            this.onSend(messages)
          }}
          alwaysShowSend
          onPressAvatar={this.handleAvatarPress}
          messageIdGenerator={this.messageIdGenerator}
          renderBubble={this.renderBubble}
          user={{
            _id: username,
            name: username,
            avatar: "https://robohash.org/" + username
          }}

        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  online_user_avatar: {
    width: 50,
    height: 50,
    borderRadius: 20,
    margin: 10
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF"
  },
  welcome: {
    fontSize: 20,
    textAlign: "center",
    margin: 10
  },
  footerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7bb64"
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    margin: 10
  },
  online_user_wrapper: {
    height: "8%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  avatar_wrapper: {},
  istyping_gif: {
    position: "absolute",
    left: 20,
    height: 30,
    width: 30
    // justifyContent: "flex-end"
  }
});
