import React from "react";

const CountryFlagEmoji = (params: { country: string }) => {
    const { country } = params;

    // Fonction pour convertir un code pays en emoji de drapeau
    const getFlagEmoji = (countryCode: string) => {
        if (!countryCode || countryCode.length !== 2) {
            return null;
        }

        // Convertir les lettres en codepoints Unicode régionaux
        const codePoints = countryCode
            .toUpperCase()
            .split("")
            .map(char => 127397 + char.charCodeAt(0));

        return String.fromCodePoint(...codePoints);
    };

    // Fonction pour obtenir le code pays à partir du nom du pays
    const getCountryCode = (countryName: string) => {
        const countryToCode: Record<string, string> = {
            france: "FR",
            réunion: "RE",
            germany: "DE",
            spain: "ES",
            italy: "IT",
            "united kingdom": "GB",
            "united states": "US",
            belgium: "BE",
            austria: "AT",
            netherlands: "NL",
            "the netherlands": "NL",
            "south africa": "ZA",
            denmark: "DK",
            canada: "CA",
            brazil: "BR",
            colombia: "CO",
            japan: "JP",
            china: "CN",
            algeria: "DZ",
            "french guiana": "GF",
            ukraine: "UA",
            australia: "AU",
            switzerland: "CH",
            russia: "RU",
            india: "IN",
            mexico: "MX",
            norway: "NO",
            sweden: "SE",
            finland: "FI",
            portugal: "PT",
            poland: "PL",
            turkey: "TR",
            greece: "GR",
            argentina: "AR",
            chile: "CL",
            "new zealand": "NZ",
            ireland: "IE",
            luxembourg: "LU",
            "czech republic": "CZ",
            hungary: "HU",
            romania: "RO",
            "saudi arabia": "SA",
            egypt: "EG",
            morocco: "MA",
            tunisia: "TN",
            "south korea": "KR",
            thailand: "TH",
            vietnam: "VN",
            indonesia: "ID",
            malaysia: "MY",
            singapore: "SG",
            philippines: "PH",
            israel: "IL",
            "united arab emirates": "AE",
            qatar: "QA",
            kuwait: "KW"
        };

        const normalizedName = countryName.toLowerCase();
        return countryToCode[normalizedName] || countryName.toUpperCase();
    };

    // Déterminer si l'entrée est un code pays ou un nom de pays
    const isCountryCode = (input: string) => {
        return input && input.length === 2 && /^[A-Za-z]+$/.test(input);
    };

    // Récupérer le code pays
    const countryCode = isCountryCode(country)
        ? country.toUpperCase()
        : getCountryCode(country);

    // Générer l'emoji
    const flagEmoji = getFlagEmoji(countryCode);

    return <span>{flagEmoji || "🌍"}</span>;
};

export default CountryFlagEmoji;
