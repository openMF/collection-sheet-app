angular.module('app', []).controller('content', function($scope, $http, $timeout, $interval) {
    $scope.master = {
        input: {},
        sync: {},
        auth: {},
        md5: {},
        delay: 0,
        key: '1234',
        storage: true,
        connection: true,
        authorised: true,
        sheet: true,
        connection: true
    };
    
    $scope.init = function() {
        var transaction = window.indexedDB.open('form', 1);

        transaction.onupgradeneeded = function(event) {
            $scope.master.storage = false;

            if($scope.master.key) {
                var database = event.target.result;
                database.createObjectStore('fields', {keyPath: 'name'});
                var loginStore = database.createObjectStore('login', {keyPath: 'name'});

                loginStore.add({name: 'credentials', username: $scope.master.md5.username, password: $scope.master.md5.password});
                loginStore.add({name: 'key', value: $scope.master.key});
                
                $scope.populate();
            }
            else {
                $timeout(function() {
                    $scope.master.connection = false;
                });
                window.indexedDB.deleteDatabase('form');
            }
        };

        transaction.onsuccess = function(event) {
            if($scope.master.storage) {
                var database = event.target.result;
                var loginStore = database.transaction(['login'], 'readonly').objectStore('login');

                var request = loginStore.get('credentials');
                request.onsuccess = function(event) {
                    if((request.result.username == $scope.master.md5.username) && (request.result.password == $scope.master.md5.password)) {
                        $scope.populate();
                    }
                    else {
                        $timeout(function() {
                            $scope.master.authorised = false;
                        });
                    }
                };
            }
        }
    };
    
    $scope.populate = function() {
        var httpRequest = {
            method: 'GET',
            url: 'receive.json',
            headers: {
                'Authorization': 'Basic ' + $scope.master.key
            }
        };
        
        $http(httpRequest).success(function(data, status, headers, config) {
            var transaction = window.indexedDB.open('form', 1);
            
            transaction.onsuccess = function(event) {
                var database = event.target.result;
                var objectStore = database.transaction(['fields'], 'readwrite').objectStore('fields');
                
                if($scope.master.storage) {
                    objectStore.openCursor().onsuccess = function(event) {
                        var cursor = event.target.result;

                        if(cursor) {
                            $scope.master.input[cursor.key] = cursor.value.value;
                            cursor.continue();
                        }
                        else {
                            $scope.update();
                            $scope.master.login = true;
                            $scope.master.authorised = true;
                            $scope.master.connection = true;
                            $scope.master.sheet = false;
                            $scope.$apply();
                        }
                    };
                }
                else {                    
                    for(var index in data) {
                        (function() {
                            var key = index;
                            objectStore.add({name: key, value: data[key], synced: true});
                            $timeout(function() {
                                $scope.master.input[key] = data[key];
                            });
                        })();
                    };
                    $scope.master.login = true;
                    $scope.master.sheet = false;
                    $scope.update();
                }
            }
        });
    };
    
    $scope.click = function() {
        var transaction = window.indexedDB.open('form', 1);
        
        transaction.onsuccess = function(event) {
            var database = event.target.result;
            var objectStore = database.transaction(['fields'], 'readwrite').objectStore('fields');
            
            for(var index in $scope.master.input) {
                (function() {
                    var key = index;
                    var request = objectStore.get(key);
                    request.onsuccess = function(event) {
                        var result = request.result;
                        if(result.value != $scope.master.input[key]) {
                            result.value = $scope.master.input[key];
                            result.synced = false;
                        }
                        objectStore.put(result);
                    };
                })();
            }
        };
    };
    
    $scope.reset = function() {
        window.indexedDB.deleteDatabase('form');
        location.reload();
    };  
    
    $scope.update = function() {
        $interval(function() {
            var transaction = window.indexedDB.open('form', 1);

            transaction.onsuccess = function(event) {
                var database = event.target.result;
                var objectStore = database.transaction(['fields'], 'readwrite').objectStore('fields');

                objectStore.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if(cursor) {
                        if(!cursor.value.synced) {
                            $scope.master.sync[cursor.key] = cursor.value.value;
                            cursor.value.synced = true;
                            objectStore.put(cursor.value);
                        }
                        cursor.continue();
                    }
                    else {
                        if(!angular.equals({}, $scope.master.sync)) {
                            /*var httpRequest = {
                                method: 'POST',
                                url: 'send',
                                headers: {
                                    'Authorization': 'Basic ' + $scope.master.key
                                },
                                data: $scope.master.sync
                            };
                            
                            $http(httpRequest).success(function(data, status, headers, config) {*/
                                $scope.master.sync = {};
                                $scope.master.delay = 0;
                            //});
                        }
                    }
                };
            };
        }, 5000);
        
        $interval(function() {
            $scope.master.delay++;
        }, 1000);
    };

    $scope.login = function() {
        $scope.master.md5.username = CryptoJS.SHA3($scope.master.auth.username).toString();
        $scope.master.md5.password = CryptoJS.SHA3($scope.master.auth.password).toString();
        
        /*$http.post(authentication, {username: $scope.master.auth.username, password: $scope.master.auth.password}).success(function(data, status, headers, config) {
            $scope.master.key = data.base64EncodedAuthenticationKey;*/
            $scope.init();
        /*}).error(function(data, status, headers, config) {
            $timeout(function() {
                $scope.init();
            });
        });*/
    }
});