// Import the neccesary modules.
import asyncq from "async-q";
import bytes from "bytes";

import BaseExtractor from "./baseextractor";
import Helper from "../helpers/moviehelper";
import Util from "../../util";
import { maxWebRequest, movieMap } from "../../config/constants";

/** Class for extracting movies from torrents. */
export default class Extractor extends BaseExtractor {

  /**
   * Create an extractor object for movies.
   * @param {String} name - The name of the torrent provider.
   * @param {Boolean} debug - Debug mode for extra output.
   */
  constructor(name, contentProvider, debug) {
    super(name, contentProvider);

    /**
     * The helper object for adding movies.
     * @type {Helper}
     */
    this._helper = new Helper(this.name);

    /**
     * The util object with general functions.
     * @type {Util}
     */
    this._util = new Util();
  };

  /**
   * Get all the movies.
   * @param {Object} movie - The movie information.
   * @returns {Movie} - A movie.
   */
  async _getMovie(movie) {
    try {
      const newMovie = await this._helper.getTraktInfo(movie.slugYear);
      if (newMovie && newMovie._id) return await this._helper.addTorrents(newMovie, movie.torrents);
    } catch (err) {
      return this._util.onError(err);
    }
  };

  /**
   * Extract movie information based on a regex.
   * @param {Object} torrent - The torrent to extract the movie information from.
   * @param {String} language - The language of the torrent.
   * @param {Regex} regex - The regex to extract the movie information.
   * @returns {Object} - Information about a movie from the torrent.
   */
  _extractMovie(torrent, language, regex) {
    let movieTitle = torrent.title.match(regex)[1];
    if (movieTitle.endsWith(" ")) movieTitle = movieTitle.substring(0, movieTitle.length - 1);
    movieTitle = movieTitle.replace(/\./g, " ");
    let slug = movieTitle.replace(/\s+/g, "-").toLowerCase();
    slug = slug in movieMap ? movieMap[slug] : slug;
    const year = torrent.title.match(regex)[2];
    const quality = torrent.title.match(regex)[3];

    const size = torrent.size ? torrent.size : torrent.fileSize;

    const movie = {
      movieTitle,
      slug,
      slugYear: `${slug}-${year}`,
      torrentLink: torrent.link,
      year,
      quality,
      language
    };
    movie.torrents = {};

    movie.torrents[language] = {};
    movie.torrents[language][quality] = {
      url: torrent.torrent_link ? torrent.torrent_link : torrent.magnet,
      seed: torrent.seeds ? torrent.seeds : 0,
      peer: torrent.peers ? torrent.peers : 0,
      size: bytes(size.replace(/\s/g, "")),
      filesize: size,
      provider: this.name
    };

    return movie;
  };

  /**
   * Get movie info from a given torrent.
   * @param {Object} torrent - A torrent object to extract movie information from.
   * @param {String} language - The language of the torrent.
   * @returns {Object} - Information about a movie from the torrent.
   */
  _getMovieData(torrent, language) {
    const threeDimensions = /(.*).(\d{4}).[3Dd]\D+(\d{3,4}p)/i;
    const fourKay = /(.*).(\d{4}).[4k]\D+(\d{3,4}p)/i;
    const withYear = /(.*).(\d{4})\D+(\d{3,4}p)/i;
    if (torrent.title.match(threeDimensions)) {
      return this._extractMovie(torrent, language, threeDimensions);
    } else if (torrent.title.match(fourKay)) {
      return this._extractMovie(torrent, language, fourKay);
    } else if (torrent.title.match(withYear)) {
      return this._extractMovie(torrent, language, withYear);
    } else {
      logger.warn(`${this.name}: Could not find data from torrent: '${torrent.title}'`);
    }
  };

  /**
   * Puts all the found movies from the torrents in an array.
   * @param {Array} torrents - A list of torrents to extract movie information.
   * @param {String} language - The language of the torrent.
   * @returns {Array} - A list of objects with movie information extracted from the torrents.
   */
  async _getAllMovies(torrents, language) {
    try {
      const movies = [];
      await asyncq.mapSeries(torrents, torrent => {
        if (torrent) {
          const movie = this._getMovieData(torrent, language);
          if (movie) {
            if (movies.length != 0) {
              const { movieTitle, slug, language, quality } = movie;
              const matching = movies
                .filter(m => m.movieTitle === movieTitle)
                .filter(m => m.slug === slug);

              if (matching.length != 0) {
                const index = movies.indexOf(matching[0]);
                if (!matching[0].torrents[language][quality]) matching[0].torrents[language][quality] = movie.torrents[language][quality];

                movies.splice(index, 1, matching[0]);
              } else {
                movies.push(movie);
              }
            } else {
              movies.push(movie);
            }
          }
        }
      });
      return movies;
    } catch (err) {
      return this._util.onError(err);
    }
  };

  /**
   * Returns a list of all the inserted torrents.
   * @param {Object} provider - The provider to query content provider.
   * @returns {Array} - A list of scraped movies.
   */
  async search(provider) {
    try {
      provider.query.page = 1;
      provider.query.verified = 1;
      provider.query.adult_filter = 1;
      provider.query.language = provider.query.language ? provider.query.language : "en";

      const getTotalPages = await this._contentProvider.search(provider.query);
      const totalPages = getTotalPages.total_pages; // Change to 'const' for production.
      if (!totalPages) return this._util.onError(`${this.name}: total_pages returned: '${totalPages}'`);
      // totalPages = 3; // For testing purposes only.
      logger.log(`${this.name}: Total pages ${totalPages}`);

      const torrents = await this._getAllTorrents(totalPages, provider);
      const movies = await this._getAllMovies(torrents, provider.query.language);
      return await asyncq.mapLimit(movies, maxWebRequest,
        movie => this._getMovie(movie).catch(err => this._util.onError(err)));
    } catch (err) {
      this._util.onError(err);
    }
  };

};
