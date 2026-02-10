const MAX_RESULTS = 50;

export const fetchUserPlaylists = async (youtube) => {
    let items = [];
    let pageToken = '';

    do {
        const res = await youtube.playlists({
            part: 'snippet,contentDetails',
            maxResults: MAX_RESULTS,
            mine: true,
            pageToken
        });
        items = items.concat(res.items || []);
        pageToken = res.nextPageToken || '';
    } while (pageToken);

    return items.map((item) => ({
        id: item.id,
        name: item.snippet?.title || ''
    }));
};

export default {
    fetchUserPlaylists
};
