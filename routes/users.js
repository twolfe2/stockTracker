'use strict';


const express = require('express');
const request = require('request');
const async = require('async');


let router = express.Router();

let User = require('../models/user');
const FACEBOOK_SECRET = process.env.FACEBOOK_SECRET;

/// /api/users


// router.post('/facebook', (req,res) => {
//   //1. User the Auth Code (req.body.code) to request the Access Token
//   //2. Use the Access Token to request the user's profile.
//   //3. Use their profile to either: 
//   //    a. Create a new account in our database for our user
//   //    b. Retrieve an existing user from out db
//   //4. Generate a JWT and respond with it.
//   // console.log('req.body:', req.body);

//   res.send();
// })



router.get('/profile', User.authorize({admin: false}), (req,res) => {
  // console.log(req.user);
  res.send(req.user);

});

router.get('/', User.authorize({admin: false}), (req,res) => {
  User.find({_id: {$ne: req.user._id}}, (err, users) => {
    res.status(err ? 400:200).send(err || users);
  })
})


router.delete('/all', User.authorize({admin: true}), (req,res) => {
  User.remove({}, err => {
    res.status(err ? 400:200).send();
  });
});


router.put('/:id/toggleAdmin', User.authorize({admin: true}), (req,res) => {
  if(req.user._id.toString() === req.params.id) {
    return res.status(400).send({error: 'Cannot toggle yourself'});
  }
  User.findById(req.params.id, (err, user) => {
    if(err || !user) return res.status(400).send(err || {error: 'User not found'});

    user.admin = !user.admin;

    user.save(err => {
      res.status(err ? 400:200).send(err);
    });
  });
});


router.post('/signup', (req,res) => {
  console.log('req.body:',req.body);
  User.register(req.body, (err, token) => {
    res.status(err ? 400 : 200).send(err || {token: token});
  });
});

router.post('/login', (req,res) => {
  // console.log('req.body:',req.body);
  User.authenticate(req.body, (err, token) => {
    res.status(err ? 400 : 200).send(err || {token: token});
  });
});



router.post('/addStock',User.authorize({admin: false}), (req,res) => {
  User.findById(req.user._id, (err, user) => {
    user.stocks.push(req.body.symbol);
    user.save((err, updatedUser) => {
      if(err) return res.status(400).send(err);
      res.send();
    });
  });
});


router.delete('/removeStock/:sym', User.authorize({admin: false}), (req,res) => {
  console.log(req.params.sym);
  // res.send();
  User.findByIdAndUpdate(req.user._id, {$pull: {stocks: req.params.sym}},(err, updatedUser) => {
   if(err) return res.status(400).send(err);
   res.send(updatedUser.stocks);
  });
});

//get the stocks and make api calls to get current info for each one
router.get('/stocks', User.authorize({admin:false}), (req,res) => {
  User.findById(req.user._id, (err, user) => {
    let APICalls = [];
    let call;

    //create an array of api calls
    user.stocks.forEach(stock => {
      // console.log(stock);
      call=`http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol=${stock}`;
      APICalls.push(call);
    });

    //make the api calls 
    async.map(APICalls,
      function(item, callback){
        request.get(item, (err,response,stock) => {
          if(err) {
            callback(error);
          };
          callback(null, JSON.parse(stock));
        })
      },
      function(err, results) {
        if(err) {
          res.status(400).send(err);
        }
        res.send(results);
      }
 
      )
    
    
  });
})


router.post('/facebook', function(req, res) {

  

  var fields = ['id', 'email', 'first_name', 'last_name', 'link', 'name', 'location', 'birthday','gender','picture'];
  var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
  var graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(',');
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: FACEBOOK_SECRET,
    redirect_uri: req.body.redirectUri
  };

  // Step 1. Exchange authorization code for access token.
  request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
    if (response.statusCode !== 200) {
      return res.status(400).send({ message: accessToken.error.message });
    }

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: graphApiUrl, qs: accessToken, json: true }, function(err, response, profile) {
      if (response.statusCode !== 200) {
        return res.status(400).send({ message: profile.error.message });
      }

      console.log('profile:',profile);
      // res.send();


      User.findOne({facebook: profile.id}, (err,user) => {
        if(err) return res.status(400).send(err);

        if(user) {
          //returning user
          let token = user.generateToken();
          //generate the token 
          //send the token
          res.send({token: token});
        } else {
          //new user
          let newUser = new User({
            email: profile.email,
            displayName: profile.name,
            profileImage: profile.picture.data.url,
            facebook: profile.id
          });

          newUser.save((err,savedUser) => {
            if(err) return res.status(400).send(err);

            let token = savedUser.generateToken();
            res.send({token: token});
          })
          //create new user
          //save to db
          //respond with token
        }
       })
      // if (req.header('Authorization')) {
      //   User.findOne({ facebook: profile.id }, function(err, existingUser) {
      //     if (existingUser) {
      //       return res.status(409).send({ message: 'There is already a Facebook account that belongs to you' });
      //     }
      //     var token = req.header('Authorization').split(' ')[1];
      //     var payload = jwt.decode(token, config.TOKEN_SECRET);
      //     User.findById(payload.sub, function(err, user) {
      //       if (!user) {
      //         return res.status(400).send({ message: 'User not found' });
      //       }
      //       user.facebook = profile.id;
      //       user.picture = user.picture || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
      //       user.displayName = user.displayName || profile.name;
      //       user.save(function() {
      //         var token = createJWT(user);
      //         res.send({ token: token });
      //       });
      //     });
      //   });
      // } else {
      //   // Step 3. Create a new user account or return an existing one.
      //   User.findOne({ facebook: profile.id }, function(err, existingUser) {
      //     if (existingUser) {
      //       var token = createJWT(existingUser);
      //       return res.send({ token: token });
      //     }
      //     var user = new User();
      //     user.facebook = profile.id;
      //     user.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
      //     user.displayName = profile.name;
      //     user.save(function() {
      //       var token = createJWT(user);
      //       res.send({ token: token });
      //     });
      //   });
      // }
    });
  });
});


module.exports = router;  