// Import the neccesary modules.
import asyncq from "async-q";
import ExtraTorrentAPI from "extratorrent-api";

import Extractor from "../extractors/showextractor";
import Util from "../../util";

/** Class for scraping shows from https://extratorrent.cc/. */
export default class ExtraTorrent {

   /**logger
    * Create an extratorrent object.
    * @param {String} name - The name of the torrent provider.
    * @param {Boolean} debug - Debug mode for extra output.
    */
  constructor(name, debug) {
    /**
     * The name of the torrent provider.
     * @type {String}
     */
    this.name = name;

    /**
     * The extractor object for getting show data on torrents.
     * @type {Extractor}
     */
    this._extractor = new Extractor(this.name, new ExtraTorrentAPI({ debug }), debug);

    /**
     * The util object with general functions.
     * @type {Util}
     */
    this._util = new Util();
  };

  /**
   * Returns a list of all the inserted torrents.
   * @param {Object} provider - The provider to query https://extratorrent.cc/.
   * @returns {Array} - A list of scraped shows.
   */
  async search(provider) {
    try {
      logger.log(`${this.name} : Starting scraping...`);
      provider.query.category = "tv";

      return await this._extractor.search(provider);
    } catch (err) {
      return this._util.onError(err);
    }
  };

};
