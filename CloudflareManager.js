import fetch from 'node-fetch';

export class CloudflareManager {
    #apiToken;
    #apiUrl = 'https://api.cloudflare.com/client/v4';

    setApiToken(token) {
        this.#apiToken = token;
    }

    async createDNSRecord(domain, subdomain, ip) {
        const zoneId = await this.getZoneId(domain);
        if (!zoneId) return false;

        subdomain = subdomain.toLowerCase();

        const recordName = subdomain === '@' ? domain : 
                          subdomain === '*' ? `*.${domain}` : 
                          subdomain === '*.*' ? `*.*.${domain}` : 
                          `${subdomain}.${domain}`;

        const existingRecord = await this.#findExistingRecord(zoneId, recordName);
        const recordData = { type: 'A', name: recordName, content: ip, proxied: true };

        const response = await this.#makeRequest(
            existingRecord ? `zones/${zoneId}/dns_records/${existingRecord.id}` : `zones/${zoneId}/dns_records`,
            existingRecord ? 'PUT' : 'POST',
            recordData
        );

        return response?.success || false;
    }

    async getDomains() {
        let result = [];
        let page = 1;

        while (true) {
            const params = {
                direction: 'desc',
                per_page: 100,
                page: page,
                status: 'active'
            };

            const response = await this.#makeRequest('zones', 'GET', params);

            if (!response?.success) {
                console.error('Failed getting domains from Cloudflare:', response);
                break;
            }

            result = [...result, ...response.result];

            if (page >= (response.result_info?.total_pages || 0)) {
                break;
            }

            page++;
        }

        return result.map(zone => zone.name);
    }

    async getZoneId(domain) {
        const response = await this.#makeRequest('zones', 'GET', { name: domain });
        return response?.success ? response.result[0]?.id : null;
    }

    async #makeRequest(endpoint, method = 'GET', data = null) {
        const headers = {
            'Authorization': `Bearer ${this.#apiToken}`,
            'Content-Type': 'application/json'
        };

        const options = {
            method,
            headers
        };

        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }

        try {
            const url = new URL(`${this.#apiUrl}/${endpoint}`);
            if (method === 'GET' && data) {
                Object.entries(data).forEach(([key, value]) => 
                    url.searchParams.append(key, value)
                );
            }

            const response = await fetch(url, options);
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            return { success: false, error };
        }
    }

    async #findExistingRecord(zoneId, name) {
        const searchName = name.replace('*.', '');
        
        const response = await this.#makeRequest(
            `zones/${zoneId}/dns_records`,
            'GET',
            { name: searchName }
        );

        if (!response?.success) {
            return null;
        }

        return response.result.find(record => 
            record.name === name || 
            (record.name === `*.${searchName}` && name.includes('*'))
        );
    }
}
