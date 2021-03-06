'use strict';

define([
  'underscore',
  'backbone',
  'datastore',
  'queue',
  'collections/episodes',
  'require'
], function(_, Backbone, DataStore, queue, Episodes, require) {
    var EpisodeModel = Backbone.Model.extend({
        collection: Episodes,
        defaults: {
            isDownloaded: false,
            playbackPosition: 0,
            url: null
        },

        // Access (or set) an app's blob data in indexedDB.
        blob: function(blobDataOrCallback) {
          if (blobDataOrCallback instanceof Function) {
            this._getBlob(blobDataOrCallback);
          } else {
            this._setBlob(blobDataOrCallback);
          }
        },

        // Output the published date of this podcast in a pretty way.
        date: function() {
          var date = new Date(this.get('datePublished'));
          return date.toLocaleDateString();
        },

        // Extend Backbone's default destroy method so we also delete the
        // podcast blob in indexedDB.
        destroy: function(options) {
            DataStore.destroy('e{id}'.format({id: this.get('id')}));

            return Backbone.Model.prototype.destroy.call(this, options);
        },

        // TODO: Fire an event that says we've queued this download, so we
        // can display this information in the UI.
        // TODO: Hook the above into the UI.
        download: function() {
            queue.add('e{id}'.format({id: this.get('id')}), this);
            this.trigger('download:queued');
        },

        podcast: function() {
            var Podcasts = require('collections/podcasts');
            return Podcasts.where({id: this.get('podcastID')})[0];
        },

        // Download a podcast's audio file. Called by the download queue
        // manager, so we don't try to download one hundred MP3s at once!
        _download: function() {
            var self = this;

            this.trigger('download:started');

            var request = new window.XMLHttpRequest({mozSystem: true});

            request.open('GET', this.get('enclosure'), true);
            request.responseType = 'blob';

            request.addEventListener('load', function(event) {
                // TODO: Make this better.
                // Assume "mpeg" = MP3, for now. Kinda hacky.
                var type = request.response.type.split('/')[1]

                if (type === 'mpeg') {
                    type = 'mp3';
                }

                self.set({type: type});
                self.save();
                self.blob(request.response);
                queue.done('e{id}'.format({id: self.get('id')}));
            });

            request.send(null);
        },

        _getBlob: function(callback) {
          DataStore.get(this.id, callback);
        },

        _setBlob: function(blob) {
          var self = this;

          DataStore.set(this.id, blob, function() {
            self.set({
              isDownloaded: true
            });
            self.save();
            self.trigger('downloaded');
            self.trigger('updated');
          });
        }
    });

    return EpisodeModel;
});
