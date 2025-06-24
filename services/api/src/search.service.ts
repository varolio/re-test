import { Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import axios from 'axios';

@Injectable()
export class SearchService {
  private esClient: Client;

  constructor() {
    const esHost = process.env.ES_HOST || 'localhost';
    const esPort = process.env.ES_PORT || '9200';
    
    this.esClient = new Client({
      node: `http://${esHost}:${esPort}`,
    });
  }

  async checkSystemReady() {
    try {
      const response = await axios.get('http://indexer:5000/health');
      return response.data.ready;
    } catch (error) {
      return false;
    }
  }

  async updateTicketStatus(email: string, status: string) {
    try {
      const response = await axios.post('http://indexer:5000/update_status', {
        email,
        status
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to update status');
    }
  }

  async searchTickets(query: string, filterUnresolved: boolean = false, sortOrder: string = 'priority-high-to-low') {
    try {
      const mustClauses = [];
      const shouldClauses = [];
      const filterClauses = [];

      if (filterUnresolved) {
        filterClauses.push({
          bool: {
            must_not: {
              term: { status: 'resolved' }
            }
          }
        });
      }

      const searchBody = {
        query: {
          bool: {
            must: mustClauses,
            should: [
              { 
                match: { 
                  title: {
                    query: query,
                    boost: 5.0,
                    fuzziness: "AUTO"
                  }
                }
              },
              { 
                match: { 
                  description: {
                    query: query,
                    boost: 2.0
                  }
                }
              },
              { 
                match: { 
                  tags: {
                    query: query,
                    boost: 0.5
                  }
                }
              },
              {
                wildcard: {
                  customer_email: {
                    value: `*${query}*`,
                    boost: 10.0
                  }
                }
              }
            ],
            filter: filterClauses,
            minimum_should_match: 4
          }
        },
        sort: [
          { _score: { order: 'asc' as const } },
          { priority: { order: sortOrder === 'priority-high-to-low' ? 'desc' as const : 'asc' as const } },
          { created_date: { order: 'asc' as const } }
        ],
        highlight: {
          fields: {
            title: {},
            description: {}
          }
        },
        size: 100
      };

      const response = await this.esClient.search({
        index: 'support_cases',
        body: searchBody
      });

      const results = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        title: hit._source.title,
        description: hit._source.description,
        customer_email: hit._source.customer_email,
        tags: hit._source.tags,
        status: hit._source.status,
        created_date: hit._source.created_date,
        priority: hit._source.priority || 3,
        category: hit._source.category || 'general',
        score: hit._score,
        highlights: hit.highlight
      }));

      return {
        results,
        total: typeof response.hits.total === 'object' ? response.hits.total.value : response.hits.total,
        query,
        filterUnresolved
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        results: [],
        error: 'Search failed',
        query
      };
    }
  }
} 