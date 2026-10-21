@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  @Post("register")
  registerUser(@Body() dto: CreateUserWithConsentDto) {
    logger.info("registration started");
    return this.authService.register(dto);
  }

  @Get("export-data")
  exportData() {
    return this.userService.find({ select: ["id", "email"] });
  }
}
