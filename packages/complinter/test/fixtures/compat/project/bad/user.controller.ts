// Compatibility fixture: every violation here is locked by the golden files.
@Controller("users")
export class UserController {
  @Post("register")
  registerUser(@Body() reqBody: any) {
    console.log("registering", req.body);
    axios.post("https://third-party.example", req.body);
    return this.userRepo.find();
  }

  @Delete(":id")
  removeUser(@Body() payload) {
    logger.info(`removing ${user}`);
    return this.userService.findOne({ where: { id: 1 } });
  }

  @Get("export-data")
  exportData() {
    return this.exportService.dump();
  }
}
