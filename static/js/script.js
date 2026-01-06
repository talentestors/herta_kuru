// var cdn = "https://r2.yuhiri.me/herta_kuru/";

var LANGUAGES = {
  _: {
    defaultLanguage: "zh",
    defaultVOLanguage: "ja",
    defaultSpeed: 20,
    defaultRandmo: "off",
  },
  en: "en.json",
  zh: "zh.json",
  "zh-tw": "zh-tw.json",
  ja: "ja.json",
  kr: "kr.json",
  id: "id.json",
  pt: "pt.json",
  tr: "tr.json",
  vi: "vi.json",
};

const progress = [0, 1];

(() => {
  const $ = mdui.$;

  // initialize cachedObjects variable to store cached object URLs
  var cachedObjects = {};

  function getUrl(url, cdn = null) {
    const basePath = cdn && cdn.trim() !== "" ? cdn : "static/";
    return basePath + url;
  }

  function getLang(lang, load = false) {
    if (typeof LANGUAGES[lang] !== "string" && !load) {
      return Promise.resolve(LANGUAGES[lang]);
    } else {
      const fullPath = "static/i18n/" + LANGUAGES[lang];
      return fetch(fullPath)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response failed");
          }
          return response.json();
        })
        .then((data) => {
          LANGUAGES[lang] = data;
          return data;
        })
        .catch((error) => {
          console.error(`Failed to load language "${lang}":`, error);

          if (lang !== LANGUAGES._.defaultLanguage) {
            console.log(`Falling back to default language: ${LANGUAGES._.defaultLanguage}`);
            return getLang(LANGUAGES._.defaultLanguage);
          }

          return {
            lang: "en",
            texts: {},
            cardImage: "static/img/card_en.jpg",
          };
        });
    }
  }

  // function to try caching an object URL and return it if present in cache or else fetch it and cache it
  function cacheStaticObj(origUrl) {
    if (cachedObjects[origUrl]) {
      return cachedObjects[origUrl];
    } else {
      setTimeout(() => {
        fetch(getUrl(origUrl))
          .then((response) => response.blob())
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            cachedObjects[origUrl] = blobUrl;
          })
          .catch((error) => {
            console.error(`Error caching object from ${origUrl}: ${error}`);
          });
      }, 1);
      return origUrl;
    }
  }

  let firstSquish = true;

  // This code tries to retrieve the saved language 'lang' from localStorage. If it is not found or if its value is null, then it defaults to "en".
  var current_language = localStorage.getItem("lang") || LANGUAGES._.defaultLanguage;
  var current_vo_language = localStorage.getItem("volang") || LANGUAGES._.defaultVOLanguage;
  var current_speed = localStorage.getItem("speed") || LANGUAGES._.defaultSpeed;
  var current_random_type = localStorage.getItem("random") || LANGUAGES._.defaultRandmo;

  // function that takes a textId, optional language and whether to use fallback/ default language for translation. It returns the translated text in the given language or if it cannot find the translation, in the default fallback language.
  function getLocalText(textId, language = null, fallback = true) {
    return getLang(language || current_language).then((curLang) => {
      let localTexts = curLang.texts;
      if (localTexts[textId] != undefined) {
        let value = localTexts[textId];
        if (value instanceof Array) {
          return randomChoice(value); // if there are multiple translations available for this text id, it randomly selects one of them and returns it.
        } else {
          return value;
        }
      }
      if (fallback) return getLocalText(textId, (language = "en"), (fallback = false));
      else return null;
    });
  }

  // function that updates all the relevant text elements with the translations in the chosen language.
  function multiLangMutation() {
    getLang(current_language).then((curLang) => {
      document.documentElement.lang = curLang.lang;
      let localTexts = curLang.texts;
      Object.entries(localTexts).forEach(([textId, value]) => {
        if (!(value instanceof Array))
          if (document.getElementById(textId) != undefined) document.getElementById(textId).innerHTML = value; // replaces the innerHTML of the element with the given textId with its translated version.
      });
      refreshDynamicTexts();
      document.getElementById("herta-card").src = getUrl(curLang.cardImage); // sets the image of element with id "herta-card" to the translated version in the selected language.
    });
  }

  multiLangMutation(); // the function multiLangMutation is called initially when the page loads.

  // function that returns the list of audio files for the selected language
  function getLocalAudioList() {
    return LANGUAGES[current_vo_language].audioList;
  }

  // get global counter element and initialize its respective counts
  const localCounter = document.querySelector("#local-counter");
  let localCount = localStorage.getItem("count-v2") || 0;

  // display counter
  localCounter.textContent = localCount.toLocaleString("en-US");

  // initialize timer variable and add event listener to the counter button element
  const counterButton = document.querySelector("#counter-button");

  // function freeBlob(blobUrls) {
  //   for (blobUrl in blobUrls) {
  //     URL.revokeObjectURL(blobUrl);
  //   }
  // }

  // Preload
  async function convertMp3FilesToBlob(dict, prevLang = null) {
    // if (prevLang !== null) {
    //   freeBlob(LANGUAGES[prevLang].audioList);
    //   getLang(lang, true).then((curLang) => {
    //     LANGUAGES[prevLang].audioList = curLang.audioList;
    //   });
    // }
    const promises = [];
    for (const lang in dict) {
      if (dict.hasOwnProperty(lang) && lang !== "_") {
        curLang = await getLang(lang);
        const audioList = curLang.audioList;
        if (Array.isArray(audioList)) {
          for (let i = 0; i < audioList.length; i++) {
            const url = audioList[i];
            if (typeof url === "string" && url.endsWith(".mp3")) {
              promises.push(
                loadAndEncode(getUrl(url)).then(
                  (result) => (dict[lang].audioList[i] = URL.createObjectURL(result))
                )
              );
            }
          }
        }
      }
    }
    progress[1] = Math.max(promises.length, 1);
    await Promise.all(promises);
    return dict;
  }

  function upadteProgress() {
    progress[0] += 1;
    // progress[1] = Math.max(progress[0], progress[1]);
    counterButton.innerText = `${((progress[0] / progress[1]) * 100) | 0}%`;
  }

  function loadAndEncode(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.onload = function () {
        upadteProgress();
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(xhr.statusText);
        }
      };
      xhr.onerror = function () {
        upadteProgress();
        reject(xhr.statusText);
      };
      xhr.send();
    });
  }

  function addBtnEvent() {
    counterButton.addEventListener("click", (e) => {
      localCount++;
      localCounter.textContent = localCount.toLocaleString("en-US");
      localStorage.setItem("count-v2", localCount);
      triggerRipple(e);
      playKuru();
      animateHerta();
      refreshDynamicTexts();
    });
  }

  window.onload = function () {
    // Calling method
    convertMp3FilesToBlob(LANGUAGES)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        refreshDynamicTexts();
        addBtnEvent();
        document.getElementById("loading").remove();
      });
  };

  // try caching the hertaa1.gif and hertaa2.gif images by calling the tryCacheUrl function
  cacheStaticObj("img/hertaa1.gif");
  cacheStaticObj("img/hertaa2.gif");

  // Define a function that takes an array as an argument and returns a random item from the array
  function randomChoice(myArr) {
    const randomIndex = Math.floor(Math.random() * myArr.length);
    const randomItem = myArr[randomIndex];
    return randomItem;
  }

  // Define a function that shuffles the items in an array randomly using Fisher-Yates algorithm
  function randomShuffle(myArr) {
    for (let i = myArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [myArr[i], myArr[j]] = [myArr[j], myArr[i]];
    }
    return myArr;
  }

  function getRandomAudioUrl() {
    var localAudioList = getLocalAudioList();
    if (current_vo_language == "ja") {
      const randomIndex = Math.floor(Math.random() * 2) + 1;
      return localAudioList[randomIndex];
    }
    const randomIndex = Math.floor(Math.random() * localAudioList.length);
    return localAudioList[randomIndex];
  }

  function playKuru() {
    let audioUrl;
    if (firstSquish) {
      firstSquish = false;
      audioUrl = getLocalAudioList()[0];
    } else {
      audioUrl = getRandomAudioUrl();
    }
    let audio = new Audio(); //cacheStaticObj(audioUrl));
    audio.src = audioUrl;
    audio.play();
    audio.addEventListener("ended", function () {
      this.remove();
    });
  }

  function animateHerta() {
    let id = null;
    const random = Math.floor(Math.random() * 2) + 1;
    const elem = document.createElement("img");
    let RunSpeed = Math.floor(current_speed);
    elem.src = cacheStaticObj(`img/hertaa${random}.gif`);
    elem.style.position = "absolute";
    elem.style.right = "-500px";
    elem.style.top = counterButton.getClientRects()[0].bottom + scrollY - 430 + "px";
    elem.style.zIndex = "-10";
    document.body.appendChild(elem);

    if (current_random_type == "on") {
      if (window.innerWidth >= 1280) {
        const randomSpeed = Math.floor(Math.random() * 30) + 20;
        const ReversalSpeed = Math.floor(randomSpeed);
        RunSpeed = Math.floor(randomSpeed);
      } else {
        const randomSpeed = Math.floor(Math.random() * 40) + 50;
        const ReversalSpeed = 100 - Math.floor(randomSpeed);
        RunSpeed = Math.floor(window.innerWidth / ReversalSpeed);
      }
    } else {
      const ReversalSpeed = 100 - Math.floor(current_speed);
      RunSpeed = Math.floor(window.innerWidth / ReversalSpeed);
    }

    let pos = -500;
    const limit = window.innerWidth + 500;
    clearInterval(id);
    id = setInterval(() => {
      if (pos >= limit) {
        clearInterval(id);
        elem.remove();
      } else {
        pos += RunSpeed;
        elem.style.right = pos + "px";
      }
    }, 12);
  }

  // This function creates ripples on a button click and removes it after 300ms.
  function triggerRipple(e) {
    let ripple = document.createElement("span");

    ripple.classList.add("ripple");

    const counter_button = document.getElementById("counter-button");
    counter_button.appendChild(ripple);

    let x = e.clientX - e.target.offsetLeft;
    let y = e.clientY - e.target.offsetTop;

    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    setTimeout(() => {
      ripple.remove();
    }, 300);
  }

  // This function retrieves localized dynamic text based on a given language code, and randomly replaces an element with one of the translations.
  function refreshDynamicTexts() {
    if (progress[0] !== progress[1]) return;
    getLang(current_language).then((curLang) => {
      let localTexts = curLang.texts;
      Object.entries(localTexts).forEach(([textId, value]) => {
        if (value instanceof Array)
          if (document.getElementById(textId) != undefined)
            document.getElementById(textId).innerHTML = randomChoice(value);
      });
    });
  }

  // NOTE the deployment on Github pages is stopped and deprecated. This tip is not useful anymore.
  // if (location.hostname.endsWith("duiqt.github.io")) {
  //     window.location.href = "https://herta.onrender.com";
  // }

  // This function create bilibili icon in 2 cases: activated & inactivated
  function bilibiliIcon(color) {
    return `<i class="mdui-list-item-icon mdui-icon">
        <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" style="fill: ${color};">
        <!--! Font Awesome Free 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
        <path d="M488.6 104.1C505.3 122.2 513 143.8 511.9 169.8V372.2C511.5 398.6 502.7 420.3 485.4 437.3C468.2 454.3 446.3 463.2 419.9 464H92.02C65.57 463.2 43.81 454.2 26.74 436.8C9.682 419.4 .7667 396.5 0 368.2V169.8C.7667 143.8 9.682 122.2 26.74 104.1C43.81 87.75 65.57 78.77 92.02 78H121.4L96.05 52.19C90.3 46.46 87.42 39.19 87.42 30.4C87.42 21.6 90.3 14.34 96.05 8.603C101.8 2.868 109.1 0 117.9 0C126.7 0 134 2.868 139.8 8.603L213.1 78H301.1L375.6 8.603C381.7 2.868 389.2 0 398 0C406.8 0 414.1 2.868 419.9 8.603C425.6 14.34 428.5 21.6 428.5 30.4C428.5 39.19 425.6 46.46 419.9 52.19L394.6 78L423.9 78C450.3 78.77 471.9 87.75 488.6 104.1H488.6zM449.8 173.8C449.4 164.2 446.1 156.4 439.1 150.3C433.9 144.2 425.1 140.9 416.4 140.5H96.05C86.46 140.9 78.6 144.2 72.47 150.3C66.33 156.4 63.07 164.2 62.69 173.8V368.2C62.69 377.4 65.95 385.2 72.47 391.7C78.99 398.2 86.85 401.5 96.05 401.5H416.4C425.6 401.5 433.4 398.2 439.7 391.7C446 385.2 449.4 377.4 449.8 368.2L449.8 173.8zM185.5 216.5C191.8 222.8 195.2 230.6 195.6 239.7V273C195.2 282.2 191.9 289.9 185.8 296.2C179.6 302.5 171.8 305.7 162.2 305.7C152.6 305.7 144.7 302.5 138.6 296.2C132.5 289.9 129.2 282.2 128.8 273V239.7C129.2 230.6 132.6 222.8 138.9 216.5C145.2 210.2 152.1 206.9 162.2 206.5C171.4 206.9 179.2 210.2 185.5 216.5H185.5zM377 216.5C383.3 222.8 386.7 230.6 387.1 239.7V273C386.7 282.2 383.4 289.9 377.3 296.2C371.2 302.5 363.3 305.7 353.7 305.7C344.1 305.7 336.3 302.5 330.1 296.2C323.1 289.9 320.7 282.2 320.4 273V239.7C320.7 230.6 324.1 222.8 330.4 216.5C336.7 210.2 344.5 206.9 353.7 206.5C362.9 206.9 370.7 210.2 377 216.5H377z"/>
        </svg>
        </i>`;
  }

  // This func adds avatars for credits and with href for those having social link
  function addAvatar(socialLink, currentIcon) {
    if (!currentIcon.includes("https://")) {
      currentIcon = "static/credits/" + currentIcon;
    }
    let avatar = `<img src="${currentIcon}"/>`;
    if (socialLink == "") return avatar;
    return `<a href="${socialLink}" target="_blank">${avatar}</a>`;
  }

  // This function fetches data stored in a JSON file and displays it in a dialog box.
  function showCredits() {
    fetch("static/credits/list.json")
      .then((response) => response.json())
      .then((data) => {
        var contributors = data.contributors;
        contributors = randomShuffle(contributors);
        var creditsHtmlContent = `<p>in no specific order</p>`;
        creditsHtmlContent += `<ul class="mdui-list">`;
        for (let i = 0; i < contributors.length; i++) {
          var current = contributors[i];
          let renderedName = current.username;
          if (current.name != undefined) {
            renderedName += " (" + current.name + ")";
          }
          var socialMediaIcons = bilibiliIcon("#999999");
          var socialLink = "";
          $.each(current.socialmedia, (key, value) => {
            switch (key) {
              case "bilibili":
                let uid = value.uid;
                let username = value.username;
                socialMediaIcons = `<a href="https://space.bilibili.com/${uid}" title="${username}" target="_blank" rel="noopener noreferrer">`;
                socialMediaIcons += bilibiliIcon("#00aeec");
                socialMediaIcons += `</a>`;
                break;

              case "twitter":
                socialLink = "https://twitter.com/" + value;
                break;

              case "github":
                socialLink = "https://github.com/" + value;
                break;
            }
          });
          creditsHtmlContent += `<div class="mdui-collapse">
    <div class="mdui-collapse-item">
        <div class="mdui-collapse-item-header">
            <li class="mdui-list-item mdui-ripple">
                <div class="mdui-list-item-avatar mdlist-ava-fix">
                    ${addAvatar(socialLink, current.icon)}
                </div>
                <div class="mdui-list-item-content">
                    <div class="mdui-list-item-title">${renderedName}</div>
                    <div class="mdui-list-item-text mdui-list-item-one-line">
                        <span class="mdui-text-color-theme-text">${getLocalText("CREDITS:" + current.thing)}</span>
                    </div>
                </div>
                ${socialMediaIcons}
            </li>
        </div>
    </div>
</div>`;
        }
        creditsHtmlContent += `</ul>`;

        mdui.dialog({
          title: getLocalText("dialogs-credits-title"),
          content: creditsHtmlContent,
          buttons: [
            {
              text: getLocalText("dialogs-close"),
            },
          ],
          history: false,
        });
      });
  }

  $("#show-credits-opt").on("click", () => showCredits());

  function showOptions() {
    mdui.dialog({
      title: "Options",
      content: `
<div style="min-height: 350px;" class="mdui-typo">
    <table style="width:100%">
        <tr>
            <td style="width: 33.33%">
                <label id="options-txt-lang">Page Language</label>
            </td>
            <td style="width: 33.33%"></td>
            <td id="setting-item-table-td" style="width: 33.33%">
                <select id="language-selector" class="mdui-select" mdui-select='{"position": "bottom"}'>
                    <option value="en">English</option>
                    <option value="zh">简体中文</option>
                    <option value="zh-tw">繁體中文</option>
                    <option value="ja">日本語</option>
                    <option value="kr">한국어</option>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="pt">Português-BR</option>
                    <option value="vi">Việt Nam</option>
                    <option value="tr">Türkçe</option>
                </select>
            </td>
        </tr>
        <tr>
            <td style="width: 33.33%">
                <label id="options-txt-vo-lang">Voice-Over Language</label>
            </td>
            <td style="width: 33.33%"></td>
            <td id="setting-item-table-td" style="width: 33.33%">
                <select id="vo-language-selector" class="mdui-select" mdui-select='{"position": "bottom"}'>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="kr">한국어</option>
                </select>
            </td>
        </tr>
        <tr>
            <td style="width: 33.33%">
                <label id="options-txt-random_speed">Random speed</label>
            </td>
            <td style="width: 33.33%"></td>
            <td id="setting-item-table-td" style="width: 33.33%">
                <select id="random-speed-type" class="mdui-select" mdui-select='{"position": "bottom"}'>
                    <option value="off">OFF</option>
                    <option value="on">ON</option>
                </select>
            </td>
        </tr>
        <tr>
            <td style="width: 33.33%">
                <label id="options-txt-speed">Speed</label>
            </td>
            <td style="width: 33.33%"></td>
            <td id="setting-item-table-td" style="width: 33.33%">
                <label class="mdui-slider mdui-slider-discrete">
                    <input type="range" step="1" min="0" max="95" id="speed-progress-bar"/>
                </label>
            </td>
        </tr>
    </table>
</div>`,
      buttons: [
        {
          text: getLocalText("dialogs-close"),
        },
      ],
      history: false,
      onOpen: (_inst) => {
        $("#vo-language-selector").val(current_vo_language);
        $("#language-selector").val(current_language);
        $("#random-speed-type").val(current_random_type);
        $("#speed-progress-bar").val(current_speed);

        if (current_random_type == "on") {
          $("#speed-progress-bar").prop("disabled", true);
        } else {
          $("#speed-progress-bar").removeAttr("disabled");
        }

        $("#language-selector").on("change", (ev) => {
          current_language = ev.target.value;
          localStorage.setItem("lang", ev.target.value);
          multiLangMutation();
        });

        $("#vo-language-selector").on("change", (ev) => {
          // convertMp3FilesToBlob(LANGUAGES, current_vo_language);
          current_vo_language = ev.target.value;
          localStorage.setItem("volang", ev.target.value);
        });

        $("#random-speed-type").on("change", (ev) => {
          current_random_type = ev.target.value;
          localStorage.setItem("random", ev.target.value);
          if (current_random_type == "on") {
            $("#speed-progress-bar").prop("disabled", true);
            mdui.mutation();
          } else {
            $("#speed-progress-bar").removeAttr("disabled");
            mdui.mutation();
          }
        });

        $("#speed-progress-bar").on("change", (ev) => {
          current_speed = ev.target.value;
          localStorage.setItem("speed", ev.target.value);
        });

        multiLangMutation();
        mdui.mutation();
      },
    });
  }

  $("#show-options-opt").on("click", () => showOptions());
})();
