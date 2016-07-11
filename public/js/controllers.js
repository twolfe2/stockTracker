'use strict';

var app = angular.module('myApp');

app.controller('mainCtrl', function($scope, $state, $auth, $rootScope) {
  console.log('mainCtrl!');

  $scope.isAuthenticated = () => $auth.isAuthenticated();

  if ($scope.isAuthenticated()) {
    $rootScope.currUser = $auth.getPayload();
  }
  $scope.logout = () => {
    $auth.logout();
    $state.go('home');
  };

  $scope.authenticate = provider => {
    $auth.authenticate(provider)
      .then(res => {
        $state.go('home');
      })
      .catch(err => {
        console.log('err:', err);
      })
  };

});


app.controller('loginCtrl', function($scope, $state, $auth, $rootScope) {
  console.log('loginCtrl!');

  $scope.login = () => {
    $auth.login($scope.user)
      .then(res => {
        console.log('res', res);
        // console.log($auth.getPayload());

        $state.go('stockSearch');
      })
      .catch(err => {
        console.log('err', err);
      })

  };

});


app.controller('registerCtrl', function($scope, $state, $auth) {
  console.log('registerCtrl!');

  $scope.register = () => {
    if ($scope.user.password !== $scope.user.password2) {
      $scope.user.password = null;
      $scope.user.password2 = null;
      alert('Passwords do NOT match. Try again.')
    } else {

      $auth.signup($scope.user)
        .then(res => {
          console.log('res', res);
          $state.go('login');
        })
        .catch(err => {
          console.log('err', err);
        })
    }

  };

});




app.controller('stockSearchCtrl', function($scope, Stock, User) {
  $scope.isLoading = false;

  $scope.getQuote = () => {
    $scope.isLoading = true;
    Stock.getQuote($scope.symbol)
      .then(res => {
        $scope.isLoading = false;
        $scope.symbol = '';
        $scope.quote = res.data;
      });
  };

  $scope.addToPortfolio = () => {
    User.addToPortfolio($scope.quote.Symbol)
      .then(res => {
        console.log(res.data);
        alert('Stock Added.');
      });
  };

 




});

app.controller('portfolioCtrl', function($scope, Stocks, User, Stock, $state) {
  $scope.stocks = Stocks;

  $scope.removeStock = (symbol) => {
    User.removeStock(symbol)
      .then(() => {
        console.log('removed');
        $state.reload('portfolio');
      });
  };

   $scope.reloadStocks = () => {
    User.getStocks()
      .then((data) => {
        alert('Reloaded');

        $scope.stocks = data;
      });
   };
});




app.controller('usersCtrl', function($scope, $rootScope, Users, User, $state, $q, socket, $auth) {
  $rootScope.currUser = $auth.getPayload();
  $scope.messages = [];
  $scope.sendMessage = (user) => {
    // console.log('send to:',user._id)
    // console.log($rootScope.currUser._id);
    // console.log($scope.message);
    socket.emit('sendMessage', { id: user._id, message: $scope.message, email: $rootScope.currUser.email });

  }
  console.log($rootScope.currUser._id);

  socket.on(`${$rootScope.currUser._id}`, function(data) {
    $scope.messages.push(data);
    console.log('poked');
    console.log(data);
  })

  // socket.on(User._id, function(data) {
  //   console.log(data);
  // })

  console.log($scope.switchStatus);
  $scope.users = Users;
  $scope.toggleAdmin = (user) => {
    // console.log(id);
    User.toggleAdmin(user._id)
      .catch(err => {
        user.admin = !user.admin;
        console.log('in err');
        return $q.reject({ e: err });
      })
      .then((res) => {
        // user.admin = !user.admin;
        if (!res) {
          user.admin = !user.admin;
        }
        console.log(res);
        // $state.reload('users');
      })

  }

});
