//jshint esversion:6
require("dotenv").config(); //Load all the environment variables and set them in the process environment
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const app = express();

const session = require("express-session"); //Store and persist our users through different pages
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose"); //A package which provides a strategy for authenticating username and password
const findOrCreate = require("mongoose-findorcreate");
let GitHubStrategy = require("passport-github2").Strategy;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true })); //Telling our application, takes these forms and we should be able to acess emails and password in our post and get methods

app.use(
  session({
    secret: "This is a secret",
    resave: false,
    saveUninitialized: true, //Save an empty value
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  githubId: String,
  secret: Array,
});

userSchema.plugin(passportLocalMongoose); //Hash and store our passwords and store our user in db
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/secrets",
      passReqToCallback: true,
    },
    function (request, accessToken, refreshToken, profile, done) {
      User.findOrCreate({ githubId: profile.id }, function (err, user) {
        return done(err, user, { message: "User" });
      });
    }
  )
);
app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) res.render("submit");
  else res.redirect("/");
});

app.post("/submit", function (req, res) {
  const secret = req.body.secret;

  User.findById(req.user._id, function (err, foundUser) {
    if (err) console.log(err);
    else {
      if (foundUser) {
        foundUser.secret = secret;
        foundUser.save(function () {
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get(
  "/auth/github/secrets",
  passport.authenticate("github", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) console.log(err);
    else res.redirect("/");
  });
});

app.post("/login", function (req, res) {
  const user = new User({
    email: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local", { failureRedirect: "/login" })(
        req,
        res,
        function () {
          res.redirect("/secrets");
        }
      );
    }
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", function (req, res) {
  User.find({ secret: { $ne: null } }, function (err, foundUser) {
    if (err) console.log(err);
    else {
      if (foundUser) {
        res.render("secrets", { userSecret: foundUser });
      }
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
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

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
