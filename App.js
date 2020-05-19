/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import { createStackNavigator, createAppContainer } from "react-navigation";
import Login from "./src/components/Login";
import MainChat from "./src/components/MainChat";
const AppNavigator = createStackNavigator(
  {
    Login: {
      screen: Login
    },
    MainChat: {
      screen: MainChat
    },
    // PhoneInput: {
    //   screen: PhoneInput
    // },
    // OTPVerfication: {
    //   screen: OTPVerfication
    // }
  },
  {
    initialRouteName: "Login"
  }
);
export default createAppContainer(AppNavigator);
