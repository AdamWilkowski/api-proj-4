const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const shortid = require('shortid');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MLAB_URI, (err)=>{
  if(err) {
    console.log('Database connection failed.', err);
    return;
  }
  console.log('Database connection successful!'); 
});

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: 'Username required.'
  },
  _id: {
    type: String,
    default: shortid.generate() 
  },
  count: {
    type: Number,
    default: 0
  },
  log: {
    type: Array,
    default: []
  }
});
let User = mongoose.model('User', userSchema);
let createUser = (username, done)=>{
  let user = new User({
    username: username
  });
  user.save((err, data)=>{
    if(err) return done(err);
    done(null, data);
  });
};
let userList = (done)=>{
  User.find({}, 'username _id', (err, data)=>{
    if(err) return done(err);
    done(null, data);
  });
};
let findUser = (id, done)=>{
  User.findById(id, (err, data)=>{
    if(err) return done(err);
    done(null, data);
  });
};
// Retrieve userlist
app.get("/api/exercise/users", (req, res)=>{
  let list = [];
  userList((err, users)=>{
    if(err) {
      console.log(err);
      return;
    }
    list = users;
    res.json(list);
  });
});
// Add user
app.post("/api/exercise/new-user", (req, res, next)=>{
  createUser(req.body.username, (err, data)=>{
    if(err) {
      console.log(err.name);
      return next(err);
    }
    console.log('User created!');
    res.json({username: data.username, _id: data['_id']}); 
  }); 
});
// Add exercise
app.post("/api/exercise/add", (req, res, next)=>{
  if(!req.body.userId) return res.send('"userId" field required!');
  if(!req.body.description) return res.send('"description" field required!');
  if(!req.body.duration) return res.send('"duration" field required!');
  findUser(req.body.userId, (err, user)=>{
    if(err) return next(err);
    if(!user) return res.send('Invalid _id!');
    let exercise = {
      description: String(req.body.description),
      duration: Number(req.body.duration),
      date: req.body.date ? new Date(req.body.date) : new Date(Date.now())
    };
    if(isNaN(exercise.date)) return res.send('Invalid Date!');
    exercise.date = exercise.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    user.count++;
    user.log.push(exercise);
    user.save(()=>{
      if(err) return next(err);
      console.log('Exercise added!');
      res.send({
        _id: user['_id'],
        username: user.username,
        count: user.count,
        log: user.log
      });
    });
  });
});
// Retrieve user's log
app.get('/api/exercise/log', (req, res, next)=>{
  findUser(req.query.userId, (err, user)=>{
    if(err) return next(err);
    if(!req.query.userId) return res.send('userId not specified');
    if(!user) return res.send('Invalid userId');
    
    let log = user.log,
        from = Date.parse(req.query.from),
        to = Date.parse(req.query.to),
        limit = req.query.limit;
    
    if(req.query.from) {
      if(isNaN(from)) return res.send('Invalid query value: from');
      log = log.filter(exercise => Date.parse(exercise.date) >= from);
    }
    if(req.query.to) {
      if(isNaN(to)) return res.send('Invalid query value: to');
      log = log.filter(exercise => Date.parse(exercise.date) < to);
    }
    if(req.query.limit) {
      if(isNaN(limit)) return res.send('Invalid query value: limit');
      log = log.slice(0, limit);
    }
    res.json({_id: user['_id'], username: user.username, count: user.count, log: log});
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt')
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
