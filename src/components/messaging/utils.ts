export const isSpecialMessage = (message: Message) => {
    return message?.stickerId || message?.tip || message?.file ||
    message?.type === "system" || message?.type === "join-request" || message?.content === "File"
}
 /**
 * Extracts title, description and image from a webpage's meta tags
 * Checks standard meta tags, Open Graph tags, and Twitter Card tags
 * @returns {Object} Object containing title, description, and image URL
 */
export function extractMetadata() {
    // Initialize result object
    const metadata = {
      title: null,
      description: null,
      image: null,
      url: window.location.href
    };
    
    // Extract title (in order of preference)
    metadata.title = 
      // Open Graph
      document.querySelector('meta[property="og:title"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:title"]')?.content ||
      // Standard HTML title
      document.querySelector('title')?.textContent ||
      null;
    
    // Extract description (in order of preference)
    metadata.description = 
      // Open Graph
      document.querySelector('meta[property="og:description"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:description"]')?.content ||
      document.querySelector('meta[property="twitter:description"]')?.content ||

      // Standard meta description
      document.querySelector('meta[name="description"]')?.content ||
      null;
    
    // Extract image (in order of preference)
    metadata.image = 
      // Open Graph
      document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('meta[property="og:image:url"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:image"]')?.content ||
      document.querySelector('meta[property="twitter:image"]')?.content ||
      document.querySelector('meta[name="twitter:image:src"]')?.content ||
      // Article specific (some sites use these)
      document.querySelector('meta[property="article:image"]')?.content ||
      null;
    
    return JSON.stringify(metadata);
  }