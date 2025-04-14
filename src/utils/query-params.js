/**
 * Filters URL query parameters to only include token and name
 * @param {string} url - URL with query parameters
 * @returns {string} - URL with only token and name query parameters
 */
function filterQueryParams(url) {
    // Get query parameters without creating a full URL object
    const searchParams = new URLSearchParams(url.split('?')[1] || '');
    
    // Extract only token and name
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    
    // Create new query string with only these parameters
    const newSearchParams = new URLSearchParams();
    if (token && token.trim() !== '') {
        newSearchParams.set('token', token);
    }
    if (name && name.trim() !== '') {
        newSearchParams.set('name', name);
    }
    
    // Update the request URL (keep pathname, replace query)
    const path = url.split('?')[0];
    return path + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
}

module.exports = {
    filterQueryParams
}; 