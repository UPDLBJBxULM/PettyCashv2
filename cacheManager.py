# cache_manager.py
from functools import wraps
from flask import request, jsonify
import hashlib
import json

class CacheManager:
    def __init__(self):
        self.caches = {}
        
    def generate_key(self, endpoint, params):
        return f"{endpoint}:{hashlib.md5(json.dumps(params).encode()).hexdigest()}"
    
    def cached(self, endpoint):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                params = kwargs.copy()
                cache_key = self.generate_key(endpoint, params)
                
                # Client-side validation
                client_etag = request.headers.get('If-None-Match')
                if client_etag and f"{cache_key}_etag" in self.caches:
                    if client_etag == self.caches[f"{cache_key}_etag"]:
                        return '', 304
                
                if cache_key not in self.caches:
                    data = f(*args, **kwargs)
                    self.caches[cache_key] = data
                    self.caches[f"{cache_key}_etag"] = hashlib.md5(json.dumps(data).encode()).hexdigest()
                
                return jsonify({
                    'data': self.caches[cache_key],
                    'etag': self.caches[f"{cache_key}_etag"]
                })
            return wrapper
        return decorator

    def invalidate(self, endpoint, params=None):
        if params:
            cache_key = self.generate_key(endpoint, params)
            self.caches.pop(cache_key, None)
            self.caches.pop(f"{cache_key}_etag", None)
        else:
            # Invalidate all endpoint caches if no params specified
            keys = [k for k in self.caches if k.startswith(f"{endpoint}:")]
            for k in keys:
                self.caches.pop(k, None)