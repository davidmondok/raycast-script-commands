import fetch from "node-fetch";

export default async function(
  hostname,
  isBedrock,
  apiKey,
  pullzoneId,
) {
  const apiEndpoint = `https://api.bunny.net/pullzone/${pullzoneId}`;
  const headers = {
    'AccessKey': apiKey,
  }

  async function bunnyPost(
    endpoint,
    payload,
  ) {
    try {
      const response = await fetch(`${apiEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      return await response.json();
    } catch (error) {
      console.error("Error:", error.message);
      return null;
    }
  }

  async function bunnyGetEdgeRuleGuid(descriptions) {
    try {
      const response = await fetch(`${apiEndpoint}?includeCertificate=false`, {
        method: 'GET',
        headers: {
          ...headers,
          'accept': 'application/json',
        },
      });

      const data = await response.json();

      const edgeRule = data?.EdgeRules?.find((rule) => descriptions.includes(rule.Description));

      return edgeRule?.Guid || null;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  async function createSetLinkHeaderEdgeRule(hostname) {
    const description = `${hostname} - Set Link Header`;

    const edgeRuleGuid = await bunnyGetEdgeRuleGuid([
      description,
      `Update Canonical Link for ${hostname}`
    ]);

    const payloadData = {
      Guid: edgeRuleGuid || '',
      Description: description,
      ActionType: 5,
      TriggerMatchingType: 0,
      Enabled: true,
      ActionParameter1: 'link',
      ActionParameter2: `<https://${hostname}%{Url.Directory}%{Url.FileName}>; rel=\"canonical\"`,
      Triggers: [
        {
          Type: 0,
          PatternMatchingType: 0,
          PatternMatches: [
            `https://cdn.${hostname.replace('www.', '')}/*`,
          ]
        }
      ],
    };

    return await bunnyPost('/edgerules/addOrUpdate', JSON.stringify(payloadData));
  }

  async function createChangeOriginUrlEdgeRule(hostname, isBedrock) {
    const hostnameWithoutWww = hostname.replace('www.', '');
    const description = `${hostname} - Change Origin Url`;

    const edgeRuleGuid = await bunnyGetEdgeRuleGuid([
      description,
      hostname
    ]);

    const payloadData = {
      Guid: edgeRuleGuid || '',
      Description: description,
      ActionType: 2,
      TriggerMatchingType: 0,
      Enabled: true,
      ActionParameter1: `https://${hostname}`,
      Triggers: [
        {
          Type: 0,
          PatternMatchingType: 0,
          PatternMatches: isBedrock ? [
            `https://cdn.${hostnameWithoutWww}/robots.txt`,
            `https://cdn.${hostnameWithoutWww}/favicon.ico`,
            `https://cdn.${hostnameWithoutWww}/app/*`,
            `https://cdn.${hostnameWithoutWww}/wp/*`,
          ] : [
            `https://cdn.${hostnameWithoutWww}/robots.txt`,
            `https://cdn.${hostnameWithoutWww}/favicon.ico`,
            `https://cdn.${hostnameWithoutWww}/wp-admin/*`,
            `https://cdn.${hostnameWithoutWww}/wp-content/*`,
            `https://cdn.${hostnameWithoutWww}/wp-includes/*`
          ]
        }
      ],
    };

    return await bunnyPost('/edgerules/addOrUpdate', JSON.stringify(payloadData));
  }

  return await Promise.all([
    createSetLinkHeaderEdgeRule(hostname),
    createChangeOriginUrlEdgeRule(hostname, isBedrock),
  ]);
};
