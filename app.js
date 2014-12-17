angular.module('app', []).controller('content', function($scope, $http, $timeout, $interval) {
    $scope.master = {
        data: [],
        sync: {},
        auth: {},
        sha3: {},
        delay: 0,
        current: 0,
        key: '1234',
        storage: true,
        connection: true,
        authorised: true,
        sheet: true,
        connection: true
    };
    
    $scope.init = function() {
        var transaction = window.indexedDB.open('app', 1);

        transaction.onupgradeneeded = function(event) {
            $scope.master.storage = false;

            if($scope.master.key) {
                var database = event.target.result;
                database.createObjectStore('sheets', {keyPath: 'id'});
                var loginStore = database.createObjectStore('login', {keyPath: 'name'});

                loginStore.add({name: 'credentials', username: $scope.master.sha3.username, password: $scope.master.sha3.password});
                loginStore.add({name: 'key', value: $scope.master.key});
                
                $scope.populate();
            }
            else {
                $timeout(function() {
                    $scope.master.connection = false;
                });
                window.indexedDB.deleteDatabase('app');
            }
        };

        transaction.onsuccess = function(event) {
            if($scope.master.storage) {
                var database = event.target.result;
                var loginStore = database.transaction(['login'], 'readonly').objectStore('login');

                var request = loginStore.get('credentials');
                request.onsuccess = function(event) {
                    if((request.result.username == $scope.master.sha3.username) && (request.result.password == $scope.master.sha3.password)) {
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
                'Authorization': 'Basic ' + $scope.master.key,
                'X-Mifos-Platform-TenantId': $scope.master.auth.tenant
            }
        };
        
        $http(httpRequest).success(function(data, status, headers, config) {
            var transaction = window.indexedDB.open('app', 1);
            
            transaction.onsuccess = function(event) {
                var database = event.target.result;
                var objectStore = database.transaction(['sheets'], 'readwrite').objectStore('sheets');
                
                if($scope.master.storage) {
                    objectStore.openCursor().onsuccess = function(event) {
                        var cursor = event.target.result;

                        if(cursor) {
                            $scope.master.data.push(angular.fromJson(cursor.value.value));
                            cursor.continue();
                        }
                        else {
                            $scope.master.login = true;
                            $scope.master.authorised = true;
                            $scope.master.connection = true;
                            $scope.master.sheet = false;
                            
                            $scope.update();
                            $scope.$apply();
                        }
                    };
                }
                else {   
                    $scope.master.data = data.groups;

                    for(var group in $scope.master.data) {
                        objectStore.add({id: $scope.master.data[group].groupId, value: angular.toJson($scope.master.data[group]), synced: true});
                    };

                    $scope.master.login = true;
                    $scope.master.sheet = false;

                    $scope.$apply();
                    $scope.update();
                }
            }
        });
    };
    
    $scope.click = function() {
        var transaction = window.indexedDB.open('app', 1);
        
        transaction.onsuccess = function(event) {
            var database = event.target.result;
            var objectStore = database.transaction(['sheets'], 'readwrite').objectStore('sheets');
            var request = objectStore.get($scope.master.data[$scope.master.current].groupId);
            
            request.onsuccess = function(event) {
                var result = request.result;
                if(!angular.equals(angular.fromJson(result.value), $scope.master.data[$scope.master.current])) {
                    result.value = $scope.master.data[$scope.master.current];
                    result.synced = false;
                }
                objectStore.put(result);
            };
        };
    };
    
    $scope.reset = function() {
        window.indexedDB.deleteDatabase('app');
        location.reload();
    };  
    
    $scope.update = function() {
        $interval(function() {
            var transaction = window.indexedDB.open('app', 1);

            transaction.onsuccess = function(event) {
                var database = event.target.result;
                var objectStore = database.transaction(['sheets'], 'readwrite').objectStore('sheets');

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
                                    'Authorization': 'Basic ' + $scope.master.key,
                                    'X-Mifos-Platform-TenantId': $scope.master.auth.tenant
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
        $scope.master.sha3.username = CryptoJS.SHA3($scope.master.auth.username).toString();
        $scope.master.sha3.password = CryptoJS.SHA3($scope.master.auth.password).toString();
        
       /* var httpRequest = {
            method: 'POST',
            url: 'authenticate',
            headers: {
                'X-Mifos-Platform-TenantId': $scope.master.auth.tenant
            },
            data: {username: $scope.master.auth.username, password: $scope.master.auth.password}
        };
        
        $http(httpRequest).success(function(data, status, headers, config) {
            $scope.master.key = data.base64EncodedAuthenticationKey;*/
            $scope.init();
        /*}).error(function(data, status, headers, config) {
            $timeout(function() {
                $scope.init();
            });
        });*/
    }
});