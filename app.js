angular.module('app', []).controller('form', function($scope, $http, $timeout, $interval) {
    $scope.master = {
        input: {},
        sync: {},
        delay: 0,
        storage: true,
        connection: true
    };
    
    $scope.init = function() {
        $http.get('receive.json').success(function(data, status, headers, config) {
            var transaction = window.indexedDB.open('form', 1);

            transaction.onupgradeneeded = function(event) {
                $scope.master.storage = false;

                var database = event.target.result;
                var objectStore = database.createObjectStore('fields', {keyPath: 'name'});

                for(var index in data) {
                    (function() {
                        var key = index;
                        objectStore.add({name: key, value: data[key], synced: true});
                        $timeout(function() {
                            $scope.master.input[key] = data[key];
                        });
                    })();
                };
                $scope.update();
            };

            transaction.onsuccess = function(event) {
                if($scope.master.storage) {
                    var database = event.target.result;
                    var objectStore = database.transaction(['fields'], 'readonly').objectStore('fields');
                    
                    objectStore.openCursor().onsuccess = function(event) {
                        var cursor = event.target.result;
                        
                        if(cursor) {
                            $scope.master.input[cursor.key] = cursor.value.value;
                            cursor.continue();
                        }
                        else {
                            $scope.update();
                            $scope.$apply();
                        }
                    };
                }
            };
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
    }
    
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
                            //$http.post('send', $scope.master.sync).success(function(data, status, headers, config) {
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

    $scope.init();
});