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
        success: false
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
                            if(cursor.value.synced == true) {
                                var group = angular.fromJson(cursor.value.value);
                                $scope.master.data.push(group);
                            }
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
                    }

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
                
                result.value = $scope.master.data[$scope.master.current];
                result.synced = false;
                
                objectStore.put(result);
                
                $timeout(function() {
                    $scope.master.data.splice($scope.master.current, 1);
                    $scope.master.current = 0;
                });
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
                            cursor.value.synced = 'delete';
                            objectStore.put(cursor.value);
                        }
                        
                        else if(cursor.value.synced == 'delete' && $scope.master.success) {
                            cursor.delete();
                        }
                        
                        cursor.continue();
                    }
                    
                    else {
                        $scope.master.success = false;
                        
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
                                $scope.master.success = true;
                            //});
                        }
                    }
                };
            };
        }, 10000);
        
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
    
    $scope.total = function(loan) {
        var principalPaid = parseFloat(loan.principalPaid);
        principalPaid = principalPaid || 0;
        var principalDue = parseFloat(loan.principalDue);
        principalDue = principalDue || 0;
        var interestPaid = parseFloat(loan.interestPaid);
        interestPaid = interestPaid || 0;
        var interestDue = parseFloat(loan.interestDue);
        interestDue = interestDue || 0;
        var totalDue = ((principalDue - principalPaid) + (interestDue - interestPaid)).toFixed(2);
        totalDue = totalDue || 0;
        
        loan.totalDue = totalDue;
        return totalDue;
    }
});