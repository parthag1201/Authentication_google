//jshint esversion:6
require("dotenv").config(); ///Top placement

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");

//npm i passport passport-local passport=local-mongoose express-session

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

///GOOGLE AUTH
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

// const encrypt = require("mongoose-encryption");
// const md5=require("md5");
// const bcrypt=require("bcrypt");
// const saltRounds=10;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const DB =
  "mongodb+srv://parth:parth123@cluster0.zj1fto2.mongodb.net/userDB?retryWrites=true&w=majority";

app.use(
  session({
    secret: "Our little secret is here",
    resave: false,
    saveUninitialized: false,
  })
);

//passport documentation
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(DB, {
  useNewUrlParser: true,
});

///npmjs mongoose-encryption////

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
}); ///Mongoose schema class///

userSchema.plugin(passportLocalMongoose); ///to hash and use our password
userSchema.plugin(findOrCreate); ///to create a new user using google oauth credentials

// const secret = "ThisisourlittleSecret";  --->put it into .env file

// userSchema.plugin(encrypt,{secret:secret});  ///---> Encrypt entire database
///Mongoose plugin documentation

////--->mongoose encrypt only certain fields
// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });

///Mongoose encrypt runs when we save and decrypt when we user.find

///npmjs dotenv used to safegaurd env variables form being publically avialable

const user = new mongoose.model("User", userSchema);
// use static authenticate method of model in LocalStrategy
passport.use(user.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      user.findOrCreate({ googleId: profile.id }, function (err, User) {
        return cb(err, User);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", async function (req, res) {
  const foundUsers = await user.find({ secret: { $ne: null } });
  if (foundUsers) res.render("secrets", { usersWithSecrets: foundUsers });
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) console.log(err);
    else res.redirect("/");
  });
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) res.render("submit");
  else res.redirect("/login");
});

app.post("/submit", async function (req, res) {
  const submittedSecret = req.body.secret;
  const currentUser = await user.findById(req.user.id);
  if (currentUser) {
    currentUser.secret = submittedSecret;
    currentUser.save();
    res.redirect("/secrets");
  }
});
app.post("/register", function (req, res) {
  // bcrypt.hash(req.body.password,saltRounds,function(err,hash){
  //   const newUser = new user({
  //     email: req.body.username,
  //     password: hash
  //   });
  //   newUser.save();
  //   res.render("secrets");
  // });

  //******passport*****
  user.register(
    { username: req.body.username },
    req.body.password,
    function (err, User) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", async function (req, res) {
  // const username = req.body.username;
  // const password = req.body.password;
  // //check them in the database
  // const currUser = await user.findOne({ email: username });
  // if (!currUser) {
  //   console.log("err");
  // } else {
  //   if (currUser) {
  //     //correct user
  //     bcrypt.compare(password,currUser.password,function(err,result){
  //       if(result===true)
  //       res.render("secrets");
  //     });
  //   } else console.log("Wrong pwd");
  // }

  ///passprot login

  const User = new user({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(User, function (err) {
    if (err) console.log(err);
    else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(3000, function () {
  console.log("Server on port 3000");
});
