import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('filterUnresolved') filterUnresolved: string
  ) {
    if (!query) {
      return { results: [], error: 'Query parameter is required' };
    }
    
    const filter = filterUnresolved === 'true';
    return await this.searchService.searchTickets(query, filter);
  }

  @Get('ready')
  async checkReady() {
    const ready = await this.searchService.checkSystemReady();
    return { ready };
  }

  @Post('update-status')
  async updateStatus(@Body() body: { email: string; status: string }) {
    if (!body.email || !body.status) {
      return { error: 'Email and status are required' };
    }
    
    return await this.searchService.updateTicketStatus(body.email, body.status);
  }
} 